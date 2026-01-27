import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SeepayAuthGuard implements CanActivate {
    constructor(private readonly configService: ConfigService) { }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers['authorization'];
        const apiKey = this.configService.get<string>('seepay.apiKey');

        // If no API key is configured in backend, fail open or closed?
        // Security best practice: Fail closed.
        if (!apiKey) {
            console.warn('SeepayAuthGuard: SEEPAY_API_KEY is not configured in environment variables.');
            throw new UnauthorizedException('Server Authentication Configuration Error');
        }

        if (!authHeader) {
            throw new UnauthorizedException('Missing Authorization Header');
        }

        // Expected format: "Apikey <KEY>"
        const expectedHeaderValue = `Apikey ${apiKey}`;

        if (authHeader !== expectedHeaderValue) {
            throw new UnauthorizedException('Invalid API Key');
        }

        return true;
    }
}
