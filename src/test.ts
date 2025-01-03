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


    console.log("Sunrise:", moonTimesInstance.sunrise);
    console.log("Sunset:", moonTimesInstance.sunset);
    console.log("Civil Twilight Begin:", moonTimesInstance.civilTwilightBegin);
    console.log("Civil Twilight End:", moonTimesInstance.civilTwilightEnd);
    console.log("Nautical Twilight Begin:", moonTimesInstance.nauticalTwilightBegin);
    console.log("Nautical Twilight End:", moonTimesInstance.nauticalTwilightEnd);
    console.log("Astronomical Twilight Begin:", moonTimesInstance.astronomicalTwilightBegin);
    console.log("Astronomical Twilight End:", moonTimesInstance.astronomicalTwilightEnd);
    console.log("Moonrise:", moonTimesInstance.moonrise);
    console.log("Moonset:", moonTimesInstance.moonset);

    let moonriseHours = parseInt(moonTimesInstance.moonrise.split(":")[0]);
    let moonriseMinutes = parseInt(moonTimesInstance.moonrise.split(":")[1]);
    let moonriseTotalMinutes = moonriseHours * 60 + moonriseMinutes;
    console.log("Moonrise total minutes:", moonriseTotalMinutes);

    let moonsetHours = parseInt(moonTimesInstance.moonset.split(":")[0]);
    let moonsetMinutes = parseInt(moonTimesInstance.moonset.split(":")[1]);
    let moonsetTotalMinutes = moonsetHours * 60 + moonsetMinutes;
    if (moonsetTotalMinutes < moonriseTotalMinutes) {
        moonsetTotalMinutes += 24 * 60;
    }
    console.log("Moonset total minutes:", moonsetTotalMinutes);

    let moonVisible = moonsetTotalMinutes - moonriseTotalMinutes;
    console.log("Moon visible:", moonVisible, "minutes");

    let moonVisisbleDegrees = moonVisible / (24 * 60) * 360;
    console.log("Moon visible degrees of day", moonVisisbleDegrees, " degrees");

    let offset = Math.sin((90 - moonVisible/1440 * 180) * Math.PI / 180);

    console.log ("Offset:", offset);

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
    // // success = success && await sunmoonBuilder.CreateImages("Onset, MA", "OnsetSunMoon01.jpg", "42.4", "-71.6", IPGEOLOACATION_API_KEY, "2021-01-14");
    // // success = success && await sunmoonBuilder.CreateImages("Onset, MA", "OnsetSunMoon02.jpg", "42.4", "-71.6", IPGEOLOACATION_API_KEY, "2021-02-15");
    // // success = success && await sunmoonBuilder.CreateImages("Onset, MA", "OnsetSunMoon03.jpg", "42.4", "-71.6", IPGEOLOACATION_API_KEY, "2021-03-16");
    // // success = success && await sunmoonBuilder.CreateImages("Onset, MA", "OnsetSunMoon04.jpg", "42.4", "-71.6", IPGEOLOACATION_API_KEY, "2021-04-17");
    // // success = success && await sunmoonBuilder.CreateImages("Onset, MA", "OnsetSunMoon05.jpg", "42.4", "-71.6", IPGEOLOACATION_API_KEY, "2021-05-18");
    // // success = success && await sunmoonBuilder.CreateImages("Onset, MA", "OnsetSunMoon06.jpg", "42.4", "-71.6", IPGEOLOACATION_API_KEY, "2021-06-19");
    // // success = success && await sunmoonBuilder.CreateImages("Onset, MA", "OnsetSunMoon07.jpg", "42.4", "-71.6", IPGEOLOACATION_API_KEY, "2021-07-20");
    // // success = success && await sunmoonBuilder.CreateImages("Onset, MA", "OnsetSunMoon08.jpg", "42.4", "-71.6", IPGEOLOACATION_API_KEY, "2021-08-21");
    // // success = success && await sunmoonBuilder.CreateImages("Onset, MA", "OnsetSunMoon09.jpg", "42.4", "-71.6", IPGEOLOACATION_API_KEY, "2021-09-22");
    // // success = success && await sunmoonBuilder.CreateImages("Onset, MA", "OnsetSunMoon10.jpg", "42.4", "-71.6", IPGEOLOACATION_API_KEY, "2021-10-23");
    // // success = success && await sunmoonBuilder.CreateImages("Onset, MA", "OnsetSunMoon11.jpg", "42.4", "-71.6", IPGEOLOACATION_API_KEY, "2021-11-24");
    // // success = success && await sunmoonBuilder.CreateImages("Onset, MA", "OnsetSunMoon12.jpg", "42.4", "-71.6", IPGEOLOACATION_API_KEY, "2021-12-25");

    // Sunrise before 6AM, sunset after 6PM
    //success = success && await sunmoonBuilder.CreateImages("Onset, MA", "OnsetSunMoon-June.jpg", "42.4", "-71.6", IPGEOLOACATION_API_KEY, timeZone, "2021-06-21");

    // Sunrise after 6AM and sunset before 6PM, Moon sets in the morning, rises in the afteroon
    //success = success && await sunmoonBuilder.CreateImages("Onset, MA", "OnsetSunMoon-dec.jpg", "42.4", "-71.6", IPGEOLOACATION_API_KEY, timeZone, "2021-12-21");

    // Sunset before 6PM, twilight after 6PM
    //success = success && await sunmoonBuilder.CreateImages("Onset, MA", "OnsetSunMoon-sep.jpg", "42.4", "-71.6", IPGEOLOACATION_API_KEY, timeZone, "2021-09-01");

    // Sunrise after 6AM, twilight before 6AM, Moon rises and falls in the same day
    //success = success && await sunmoonBuilder.CreateImages("Onset, MA", "OnsetSunMoon-mar.jpg", "42.4", "-71.6", IPGEOLOACATION_API_KEY, timeZone, "2021-03-08");

    logger.info(`test.ts: Done: ${success ? "successfully" : "failed"}`); 

    return success ? 0 : 1;
}

run();