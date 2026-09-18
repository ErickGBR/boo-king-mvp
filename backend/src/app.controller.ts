import { Controller, Get } from '@nestjs/common';

/** `index.js` health endpoint (#41) — `GET /api/health` → 200 {ok:true}. */
@Controller('health')
export class AppController {
  @Get()
  health() {
    return { ok: true };
  }
}
