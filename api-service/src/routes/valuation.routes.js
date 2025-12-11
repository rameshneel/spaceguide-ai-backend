import { Router } from "express";
import {
  searchCompanies,
  runValuation,
} from "../controllers/valuation.controller.js";

const router = Router();

router.get("/search", searchCompanies);
router.post("/run", runValuation);

export default router;
