import { Inject } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { isUUID } from 'class-validator';
import type { IncomingMessage } from 'node:http';
import type { WebSocket } from 'ws';
import type { AuthenticatedUser } from '../../shared/auth/authenticated-user.js';
import { UserRole } from '../../shared/auth/role.js';
import type { ITokenVerifier } from '../../shared/auth/token-verifier.js';
import { TOKEN_VERIFIER } from '../../shared/auth/token-verifier.js';
import { AuthenticationError, DomainError, ForbiddenActionError, InvalidLocationError } from '../../shared/errors.js';
import { TrackingService } from '../application/tracking.service.js';
import { presentLocation } from './location.presenter.js';

const OPEN = 1;
const POLICY_VIOLATION = 1008;

interface Reply {
  event: string;
  data: unknown;
}

@WebSocketGateway({ path: '/tracking' })
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {

  private readonly users = new WeakMap<WebSocket, AuthenticatedUser>();
  private readonly subscriptions = new Map<WebSocket, Map<string, () => void>>();

  constructor(
    private readonly tracking: TrackingService,
    @Inject(TOKEN_VERIFIER) private readonly tokens: ITokenVerifier,
  ) { }

  handleConnection(client: WebSocket, request: IncomingMessage): void {
    const token = new URL(request.url ?? '', 'http://localhost',).searchParams.get('token');
    const user = token ? this.tokens.verify(token) : null;
    if (!user) {
      client.close(POLICY_VIOLATION, 'No autorizado');
      return;
    }
    this.users.set(client, user);
  }

  @SubscribeMessage('location')
  async onLocation(@ConnectedSocket() client: WebSocket, @MessageBody() body: unknown): Promise<Reply> {
    return this.safely(async () => {
      const location = await this.tracking.report(body, this.userOf(client));
      return { event: 'ack', data: presentLocation(location) };
    });
  }

  @SubscribeMessage('subscribe')
  async onSubscribe(@ConnectedSocket() client: WebSocket, @MessageBody() body: unknown): Promise<Reply> {
    return this.safely(async () => {
      const tripId = (body as { tripId?: unknown } | null)?.tripId;
      if (typeof tripId !== 'string' || !isUUID(tripId)) {
        throw new InvalidLocationError('tripId debe ser un UUID');
      }
      const last = await this.tracking.lastLocation(
        tripId,
        this.userOf(client),
      );
      const perClient = this.subscriptions.get(client) ?? new Map();
      if (!perClient.has(tripId)) {
        perClient.set(tripId, this.tracking.subscribe(tripId, (location) => {
          if (client.readyState === OPEN) {
            client.send(JSON.stringify({
              event: 'location',
              data: presentLocation(location)
            }));
          }
        }),
        );
      }
      this.subscriptions.set(client, perClient);
      return {
        event: 'subscribed',
        data: { tripId, lastLocation: last && presentLocation(last) },
      };
    });
  }

  handleDisconnect(client: WebSocket): void {
    this.subscriptions.get(client)?.forEach((unsubscribe) => unsubscribe());
    this.subscriptions.delete(client);
  }

  private userOf(client: WebSocket): AuthenticatedUser {
    const user = this.users.get(client);
    if (!user) throw new AuthenticationError('Conexión sin token válido');
    if (user.role === UserRole.CUSTOMER) {
      throw new ForbiddenActionError('Tu rol no puede usar el seguimiento');
    }
    return user;
  }

  private async safely(work: () => Promise<Reply>): Promise<Reply> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof DomainError) {
        return { event: 'error', data: { message: error.message } };
      }
      throw error;
    }
  }
}
