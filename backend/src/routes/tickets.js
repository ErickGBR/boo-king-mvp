import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { optionalAuth } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/tickets/:id — Public ticket endpoint (no auth required).
 *
 * Returns appointment info for a QR-scanned ticket. Two visibility layers:
 * - Public (always): id, ticketNumber, status, startsAt, endsAt, business info.
 *   No guest personal data (privacy: URL may be scanned by anyone).
 * - Private (optionalAuth + owner/staff): adds guestName, guestEmail,
 *   guestPhone, notes, and canCheckIn: true.
 */
router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(404).json({ error: 'Not found' });
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { business: true },
  });

  if (!appointment) {
    return res.status(404).json({ error: 'Not found' });
  }

  // Public layer — always returned, never exposes guest personal data
  const publicAppointment = {
    id: appointment.id,
    ticketNumber: 'BK-' + String(appointment.id).padStart(6, '0'),
    status: appointment.status,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    business: {
      id: appointment.business.id,
      name: appointment.business.name,
      address: appointment.business.address,
      locationType: appointment.business.locationType,
      durationMinutes: appointment.business.durationMinutes,
      timezone: appointment.business.timezone,
    },
  };

  let canCheckIn = false;

  // Private layer — only if authenticated AND is owner or staff of the business
  if (req.user) {
    const isOwner = appointment.business.userId === req.user.id;
    if (isOwner) {
      canCheckIn = true;
    } else {
      const staffMember = await prisma.businessStaff.findUnique({
        where: {
          businessId_userId: {
            businessId: appointment.business.id,
            userId: req.user.id,
          },
        },
      });
      if (staffMember) {
        canCheckIn = true;
      }
    }

    if (canCheckIn) {
      publicAppointment.guestName = appointment.guestName;
      publicAppointment.guestEmail = appointment.guestEmail;
      publicAppointment.guestPhone = appointment.guestPhone;
      publicAppointment.notes = appointment.notes;
    }
  }

  res.json({ appointment: publicAppointment, canCheckIn });
}));

export default router;
