import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiModule } from '../ai/ai.module';
import { ExpertTalkController } from './expert-talk.controller';
import { ExpertTalkService } from './expert-talk.service';

@Module({
  imports: [AiModule],
  controllers: [ExpertTalkController],
  providers: [ExpertTalkService, PrismaService],
})
export class ExpertTalkModule {}
