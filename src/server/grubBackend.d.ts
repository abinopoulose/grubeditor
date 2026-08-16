import type { IncomingMessage, ServerResponse } from 'node:http';
export declare function handleApiRequest(req: IncomingMessage | any, res: ServerResponse | any): Promise<boolean>;
