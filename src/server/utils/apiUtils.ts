import type { ServerResponse } from 'node:http';

export function sendJsonResponse(res: ServerResponse, data: any, statusCode: number = 200) {
  res.statusCode = statusCode;
  res.end(JSON.stringify(data));
}

export function sendErrorResponse(res: ServerResponse, error: string, statusCode: number = 500) {
  res.statusCode = statusCode;
  res.end(JSON.stringify({ success: false, error }));
}
