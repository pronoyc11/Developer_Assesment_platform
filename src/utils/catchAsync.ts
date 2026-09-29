import type { NextFunction, Request, Response } from "express";

type AsyncController = (
    req: Request,
    res: Response,
    next: NextFunction
) => Promise<void>;

export const catchAsync =
    (fn: AsyncController) =>
        (req: Request, res: Response, next: NextFunction): void => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };