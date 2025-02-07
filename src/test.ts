/* eslint-disable @typescript-eslint/no-unused-vars */
import dotenv from "dotenv";
import { Logger } from "./Logger";
import { SimpleImageWriter } from "./SimpleImageWriter";
import { Kache } from "./Kache";
import { MoonBuilder as MoonBuilder } from "./MoonBuilder";
//import { sunMoonTimes } from "./sunMoonTimes";
const MoonTimes = require('sunmoontimes');

async function run() {
    dotenv.config();  // Load var from .env into the environment

    const logger: Logger = new Logger("moon-builder", "verbose");
    const cache: Kache = new Kache(logger, "moon-cache.json"); 
    const simpleImageWriter: SimpleImageWriter = new SimpleImageWriter(logger, "images");
    const moonBuilder: MoonBuilder = new MoonBuilder(logger, cache, simpleImageWriter);

    const IPGEOLOACATION_API_KEY: string | undefined = process.env.IPGEOLOACATION_API_KEY;
    const timeZone = "America/New_York";

    if (IPGEOLOACATION_API_KEY === undefined) {
        logger.error("No url specified in env IPGEOLOACATION_API_KEY");
        process.exit(1);
    }
   
    let success = true;
    success = success && await moonBuilder.CreateImages("Onset, MA", "OnsetMoon.jpg", "42.4", "-71.6", IPGEOLOACATION_API_KEY, timeZone, "");
    logger.info("===");
    success = success && await moonBuilder.CreateImages("Onset, MA", "OnsetMoon_1_Jan25.jpg", "42.4", "-71.6", IPGEOLOACATION_API_KEY, timeZone, "2025-01-25");
    logger.info("===");
    success = success && await moonBuilder.CreateImages("Onset, MA", "OnsetMoo_2_Jan15.jpg", "42.4", "-71.6", IPGEOLOACATION_API_KEY, timeZone, "2025-01-15");
    logger.info("===");
    success = success && await moonBuilder.CreateImages("Onset, MA", "OnsetMoon_3_Jan06.jpg", "42.4", "-71.6", IPGEOLOACATION_API_KEY, timeZone, "2025-01-06");
    logger.info("===");
    success = success && await moonBuilder.CreateImages("Onset, MA", "OnsetMoon_4_Feb19.jpg", "42.4", "-71.6", IPGEOLOACATION_API_KEY, timeZone, "2025-02-19");
    logger.info("===");
    success = success && await moonBuilder.CreateImages("Onset, MA", "OnsetMoon_2_Feb12.jpg", "42.4", "-71.6", IPGEOLOACATION_API_KEY, timeZone, "2025-02-12");

    logger.info(`test.ts: Done: ${success ? "successfully" : "failed"}`); 

    return success ? 0 : 1;
}

run();