import { Controller } from '@nestjs/common';
import { AudioNarrationService } from './audio-narration.service';

@Controller('audio-narration')
export class AudioNarrationController {
  constructor(private readonly audioNarrationService: AudioNarrationService) {}

  // TODO: Add audio narration endpoints here
}
