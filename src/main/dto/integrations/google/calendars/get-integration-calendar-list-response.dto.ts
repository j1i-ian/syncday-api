export class GetIntegrationCalendarListResponseDto {
    email: string;
    items:
        | Array<{
              id?: string | null;
              subject?: string | null;
          }>
        | undefined;
}
