import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import configuration, { validateEnv } from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { MailerModule } from './modules/mailer/mailer.module';
import { AuthModule } from './modules/auth/auth.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { BookingModule } from './modules/booking/booking.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ReportsModule } from './modules/reports/reports.module';
import { StaffModule } from './modules/staff/staff.module';
import { ServicesModule } from './modules/services/services.module';
import { GoogleModule } from './modules/google/google.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { AppController } from './app.controller';
import { JwtStrategy } from './common/passport/jwt.strategy';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    PassportModule,
    PrismaModule,
    MailerModule,
    AuthModule,
    BusinessesModule,
    AppointmentsModule,
    BookingModule,
    CalendarModule,
    CategoriesModule,
    ReportsModule,
    StaffModule,
    ServicesModule,
    GoogleModule,
    TicketsModule,
  ],
  controllers: [AppController],
  providers: [JwtStrategy],
})
export class AppModule {}
