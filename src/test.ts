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

    const latitude = 42.0444; // Set latitude
    const longitude = -71.2357; // Set longitude
    const timezone = -5; // Set timezone offset
    const date = new Date(); // Set the date
    const timeformat = "24h"; // Set timeFormat

    const moonTimesInstance = new MoonTimes(latitude, longitude, timezone, date, timeformat);


    // console.log("Sunrise:", moonTimesInstance.sunrise);
    // console.log("Sunset:", moonTimesInstance.sunset);
    // console.log("Civil Twilight Begin:", moonTimesInstance.civilTwilightBegin);
    // console.log("Civil Twilight End:", moonTimesInstance.civilTwilightEnd);
    // console.log("Nautical Twilight Begin:", moonTimesInstance.nauticalTwilightBegin);
    // console.log("Nautical Twilight End:", moonTimesInstance.nauticalTwilightEnd);
    // console.log("Astronomical Twilight Begin:", moonTimesInstance.astronomicalTwilightBegin);
    // console.log("Astronomical Twilight End:", moonTimesInstance.astronomicalTwilightEnd);
    // console.log("Moonrise:", moonTimesInstance.moonrise);
    // console.log("Moonset:", moonTimesInstance.moonset);

    let moonriseHours = parseInt(moonTimesInstance.moonrise.split(":")[0]);
    let moonriseMinutes = parseInt(moonTimesInstance.moonrise.split(":")[1]);
    let moonriseTotalMinutes = moonriseHours * 60 + moonriseMinutes;
    //console.log("Moonrise total minutes:", moonriseTotalMinutes);

    let moonsetHours = parseInt(moonTimesInstance.moonset.split(":")[0]);
    let moonsetMinutes = parseInt(moonTimesInstance.moonset.split(":")[1]);
    let moonsetTotalMinutes = moonsetHours * 60 + moonsetMinutes;
    if (moonsetTotalMinutes < moonriseTotalMinutes) {
        moonsetTotalMinutes += 24 * 60;
    }
    //console.log("Moonset total minutes:", moonsetTotalMinutes);

    let moonVisible = moonsetTotalMinutes - moonriseTotalMinutes;
    //console.log("Moon visible:", moonVisible, "minutes");

    let moonVisisbleDegrees = moonVisible / (24 * 60) * 360;
    //console.log("Moon visible degrees of day", moonVisisbleDegrees, " degrees");

    let offset = Math.sin((90 - moonVisible/1440 * 180) * Math.PI / 180);

    //console.log ("Offset:", offset);

    const logger: Logger = new Logger("moon-builder", "info");
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
    success = success && await moonBuilder.CreateImages("Onset, MA", "OnsetMoon-Jan25.jpg", "42.4", "-71.6", IPGEOLOACATION_API_KEY, timeZone, "2025-01-25");
    logger.info("===");
    success = success && await moonBuilder.CreateImages("Onset, MA", "OnsetMoon-Jan15.jpg", "42.4", "-71.6", IPGEOLOACATION_API_KEY, timeZone, "2025-01-15");
    logger.info("===");
    success = success && await moonBuilder.CreateImages("Onset, MA", "OnsetMoon-Jan06.jpg", "42.4", "-71.6", IPGEOLOACATION_API_KEY, timeZone, "2025-01-06");
    logger.info("===");
    success = success && await moonBuilder.CreateImages("Onset, MA", "OnsetMoon-Feb19.jpg", "42.4", "-71.6", IPGEOLOACATION_API_KEY, timeZone, "2025-02-19");
    logger.info("===");
    success = success && await moonBuilder.CreateImages("Onset, MA", "OnsetMoon-Feb12.jpg", "42.4", "-71.6", IPGEOLOACATION_API_KEY, timeZone, "2025-02-12");

    logger.info(`test.ts: Done: ${success ? "successfully" : "failed"}`); 

    return success ? 0 : 1;
}

run();