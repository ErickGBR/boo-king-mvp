import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { BookingModule } from '../booking/booking.module';
import { GoogleModule } from '../google/google.module';

@Module({
  imports: [BookingModule, GoogleModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}
