import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { BookingSlotsService } from './booking-slots.service';
import { GoogleModule } from '../google/google.module';

@Module({
  imports: [GoogleModule],
  controllers: [BookingController],
  providers: [BookingService, BookingSlotsService],
  exports: [BookingSlotsService],
})
export class BookingModule {}
