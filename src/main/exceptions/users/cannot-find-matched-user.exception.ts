import { BadRequestException } from '@nestjs/common';

export class CannotFindMatchedUser extends BadRequestException {}
