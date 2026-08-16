export function sendJsonResponse(res, data, statusCode) {
    if (statusCode === void 0) { statusCode = 200; }
    res.statusCode = statusCode;
    res.end(JSON.stringify(data));
}
export function sendErrorResponse(res, error, statusCode) {
    if (statusCode === void 0) { statusCode = 500; }
    res.statusCode = statusCode;
    res.end(JSON.stringify({ success: false, error: error }));
}
