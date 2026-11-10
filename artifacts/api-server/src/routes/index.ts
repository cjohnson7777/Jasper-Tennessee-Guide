import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dishesRouter from "./dishes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dishesRouter);

export default router;
