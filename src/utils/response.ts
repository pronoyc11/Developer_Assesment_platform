import type { Response } from "express";

interface SuccessResponse<T> {
    success: true;
    message: string;
    data: T;
}

interface ErrorResponse {
    success: false;
    message: string;
    errors: unknown[];
}

export const sendSuccess = <T>(
    res: Response,
    message: string,
    data: T,
    statusCode = 200
): Response<SuccessResponse<T>> => {
    return res.status(statusCode).json({
        success: true,
        message,
        data
    });
};

export const sendError = (
    res: Response,
    message: string,
    errors: unknown[] = [],
    statusCode = 500
): Response<ErrorResponse> => {
    return res.status(statusCode).json({
        success: false,
        message,
        errors
    });
};