import { Injectable } from '@nestjs/common';
import { ShareTimeUtilService } from '@share/services/share-time-util.service';

@Injectable()
export class InternalShareTimeUtilService extends ShareTimeUtilService {}
