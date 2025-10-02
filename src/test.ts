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
   
// 2025-10-01T18:30:07Z   [Verbose]   [# V   Update Moon] MoonImage: Curr Moon Rise (2025-10-01): 15:45 = 945
// 2025-10-01T18:30:07Z   [Verbose]   [# V   Update Moon] MoonImage: Curr Moon Set  (2025-10-01):  -:-  = null
// 2025-10-01T18:30:07Z   [Verbose]   [# V   Update Moon] MoonImage: Prev Moon Rise (2025-09-29): 14:22 = 862
// 2025-10-01T18:30:07Z   [Verbose]   [# V   Update Moon] MoonImage: Prev Moon Set  (2025-09-29):  22:51  = 1371
// 2025-10-01T18:30:07Z   [Verbose]   [# V   Update Moon] MoonImage: Next Moon Rise (2025-10-01): 15:45 = 945
// 2025-10-01T18:30:07Z   [Verbose]   [# V   Update Moon] MoonImage: Next Moon Set  (2025-10-01):  -:-  = null
// 2025-10-01T18:30:07Z   [Verbose]   [# V   Update Moon] drawMoon: age: 8.673109568227318, image: first-quarter.png
// 2025-10-01T18:30:07Z   [Verbose]   [# V   Update Moon] MoonImage: Case 3: Moon rises in a given day but does not set until the next day
// 2025-10-01T18:30:07Z   [Verbose]   [# V   Update Moon] Previous 2025-09-29 moon set: 22:51 = 1371
// 2025-10-01T18:30:07Z   [Error]   [# E** Update Moon] No nextMoonSetMinutes to determine the moon cycle.
// 2025-10-01T18:30:07Z   [Warning]   [# W*  Update Moon] MoonBuilder CreateImages: No image available



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