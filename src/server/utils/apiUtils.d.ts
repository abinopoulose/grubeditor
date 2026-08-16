import type { ServerResponse } from 'node:http';
export declare function sendJsonResponse(res: ServerResponse, data: any, statusCode?: number): void;
export declare function sendErrorResponse(res: ServerResponse, error: string, statusCode?: number): void;
