/* eslint-disable @typescript-eslint/no-unused-vars */
import jpeg from "jpeg-js";
import path from "path";
import * as pure from "pureimage";
import * as fs from "fs";

import { MoonData, MoonJson } from "./MoonData";
import { LoggerInterface } from "./Logger";
import { KacheInterface} from "./Kache";

import moment from "moment-timezone";  // https://momentjs.com/timezone/docs/ &  https://momentjs.com/docs/

export interface ImageResult {
    imageType: string;
    imageData: jpeg.BufferRet | null;
}

export interface ImageBuffer {
    width: number;
    height: number;
    data: Uint8Array;
}

export class MoonImage {
    private cache: KacheInterface;
    private logger: LoggerInterface;

    
    private imageHeight: number;
    private imageWidth: number;
    
    private moonPlotWidth: number;
    private moonPlotAplitude: number;
    private moonPlotHeight: number;
    private moonPlotX: number;
    private moonPlotY: number;
    private moonPlotYOrigin: number;

    private dateX: number;
    private dateY: number;
    private titleY: number;

    private backgroundColor: string;
    private titleColor: string;
    private labelColor: string;
    private gridColor: string;
    private gridWidth: number;
    private gridWidthMajor: number;
    private moonPathColor: string;
    private nighttimeColor: string;
    private daytimeColor: string;
    private moonPathWidth: number;
    private moonColor: string;
    private moonRadius: number;
    private largeMoonX: number;
    private largeMoonY: number;
    private largeMoonSize: number;
    private moonPhaseX: number;
    private moonPhaseY: number;

    /**
     * Constructor for MoonImage
     * @param logger Object that implements the LoggerInterface
     * @param cache Object that implements to KacheInterface
     */
    constructor(logger: LoggerInterface, cache: KacheInterface) {
        this.logger = logger;
        this.cache = cache;

        this.imageHeight = 1080; 
        this.imageWidth  = 1920; 

        this.dateX = this.imageWidth * 4/5;
        this.dateY = this.imageHeight - 20; 
        this.titleY = 90;

        this.moonPlotX         = 50;                       // In from the left side
        this.moonPlotY         = 400;                      // Upper left corner of the frame
        this.moonPlotWidth     = 1800;                     // Width of the plot (frame)
        this.moonPlotHeight    = 500;                      // Height of the plot (frame)
        this.moonPlotAplitude  = 150;                      // Nominal height of the curve, it will however be shifted up or down as needed
        this.moonPlotYOrigin   = this.moonPlotY + this.moonPlotHeight/2;                      // Y origin for the plot, down from the top

        this.backgroundColor = "#F0F0F0";              // format needed by myFillRect
        this.titleColor      = "#2020B0"; 
        this.labelColor      = "#2020B0";
        this.gridColor       = "#444";
        this.gridWidth       = 3;
        this.gridWidthMajor  = 5;
        this.nighttimeColor  = "#C0E0FF"
        this.daytimeColor    = "#FFFFDF"
        this.moonPathColor   = "#2020B0";
        this.moonPathWidth   = 4;
        this.moonColor       = "#666"; //"#303030";
        this.moonRadius      = 40;   
        this.largeMoonX      = this.imageWidth/2 - 150;
        this.largeMoonY      = 240;
        this.largeMoonSize   = 200;
        this.moonPhaseX      = this.imageWidth/2;
        this.moonPhaseY      = 255                  
    }

    /**
     * Gets data from MoonData and generates an HD image with the sun and moon rise and set 
     * @param location Location name for the title (e.g.: "Boston, MA")
     * @param lat Lattitude in decimal degrees north
     * @param lon Longitude in decimal degrees east (negative for west)
     * @param apiKey API key for https://api.ipgeolocation.io
     * @param timeZone Time zone (e.g.: "America/New_York")
     * @param dateStr Optional dataString in "YYYY-MM-DD" format
     * @returns ImageResult or null
     */
    public async getImage(location: string, lat: string, lon: string, apiKey: string, timeZone: string, dateStr = "") : Promise<ImageResult | null> {        
                
        const extraLargeFont            = "80px 'OpenSans-Bold'";     // Title
        const largeFont                 = "65px 'OpenSans-Bold'";     // Title
        const mediumFont                = "48px 'OpenSans-Regular";   // Other text
        const smallFont                 = "36px 'OpenSans-Regular'";  // Note at the bottom
        const extraSmallFont            = "30px 'OpenSans-Regular'";  // Note at the bottom

        // When used as an npm package, fonts need to be installed in the top level of the main project
        const fntBold     = pure.registerFont(path.join(".", "fonts", "OpenSans-Bold.ttf"),"OpenSans-Bold");
        const fntRegular  = pure.registerFont(path.join(".", "fonts", "OpenSans-Regular.ttf"),"OpenSans-Regular");
        const fntRegular2 = pure.registerFont(path.join(".", "fonts", "alata-regular.ttf"),"alata-regular");
        
        fntBold.loadSync();
        fntRegular.loadSync();
        fntRegular2.loadSync();

        // Instanciate the MoonData class and use it to get the moon data for today and for yesterday
        const moonData: MoonData = new MoonData(this.logger, this.cache);

        if (dateStr === "") {
            const now: moment.Moment = moment();
            dateStr = now.tz(timeZone).format("YYYY-MM-DD");
        }

        // Get the moon data for the current day
        const currentMoonJson: MoonJson | null = await  moonData.getMoonData(lat, lon, apiKey, timeZone, dateStr);

        if (currentMoonJson === null) {
            this.logger.error(`MoonImage: getImage() failed to get current data for ${location} on ${dateStr}`);
            return null;
        }

        const currentMoonRiseMinutes: number | null = this.getMinutes(currentMoonJson.moonrise);
        const currentMoonSetMinutes: number | null = this.getMinutes(currentMoonJson.moonset);

        // Get the moon data for the previous day.  This is needed if there is no rise or set in the current day.
        const prevDate: moment.Moment = moment(dateStr);
        const prevDateStr = prevDate.tz(timeZone).subtract(1, "day").format("YYYY-MM-DD");
        const previousMoonJson = await moonData.getMoonData(lat, lon, apiKey, timeZone, prevDateStr); // true to get the previous day's data

        if (previousMoonJson === null) {
            this.logger.error(`MoonImage: getImage() failed to get previous data for ${location} on ${prevDateStr}`);
            return null;
        }

        const previousMoonRiseMinutes: number | null = this.getMinutes(previousMoonJson.moonrise);
        const previousMoonSetMinutes: number | null = this.getMinutes(previousMoonJson.moonset);
         
        // Get the moon data for the next day.  This is needed to determine the moon cycle.
        const nextDate: moment.Moment = moment(dateStr);
        const nextDateStr = nextDate.tz(timeZone).add(1, "day").format("YYYY-MM-DD");
        const nextMoonJson = await moonData.getMoonData(lat, lon, apiKey, timeZone, nextDateStr); // true to get the previous day's data

        if (nextMoonJson === null) {
            this.logger.error(`MoonImage: getImage() failed to get next data for ${location} on ${nextDateStr}`);
            return null;
        }

        const nextMoonRiseMinutes: number | null = this.getMinutes(nextMoonJson.moonrise);
        const nextMoonSetMinutes: number | null = this.getMinutes(nextMoonJson.moonset);
        
        this.logger.verbose(`MoonImage: Curr Moon Rise (${dateStr}): ${currentMoonJson.moonrise} = ${currentMoonRiseMinutes !== null ? currentMoonRiseMinutes : "null"}`);
        this.logger.verbose(`MoonImage: Curr Moon Set  (${dateStr}):  ${currentMoonJson.moonset}  = ${currentMoonSetMinutes !== null ? currentMoonSetMinutes : "null"}`); 
        this.logger.verbose(`MoonImage: Prev Moon Rise (${prevDateStr}): ${previousMoonJson.moonrise} = ${previousMoonRiseMinutes !== null ? previousMoonRiseMinutes : "null"}`);
        this.logger.verbose(`MoonImage: Prev Moon Set  (${prevDateStr}):  ${previousMoonJson.moonset}  = ${previousMoonSetMinutes !== null ? previousMoonSetMinutes : "null"}`); 
        this.logger.verbose(`MoonImage: Next Moon Rise (${nextDateStr}): ${nextMoonJson.moonrise} = ${nextMoonRiseMinutes !== null ? nextMoonRiseMinutes : "null"}`);
        this.logger.verbose(`MoonImage: Next Moon Set  (${nextDateStr}):  ${nextMoonJson.moonset}  = ${nextMoonSetMinutes !== null ? nextMoonSetMinutes : "null"}`); 
        
         // We have all the data we need.  Create the image
        const img = pure.make(this.imageWidth, this.imageHeight);
        const ctx = img.getContext("2d");

        const dataDate        = new Date(currentMoonJson.date + "T00:00:00"); // Without the explicit time, Date.Parse assume this is UTC and the day is off by 1.
        const title           = `Moon Times for ${location}`;
        const dateDisplayStr  = `${moment(dataDate).format("MMM D, YYYY")}`;

        // Fill the background
        //ctx.fillStyle = backgroundColor;
        //ctx.fillRect(0, 0, imageWidth, imageHeight);
        this.myFillRect(img, 0, 0, this.imageWidth, this.imageHeight, this.backgroundColor);

        const sunriseMinutes = this.getMinutes(currentMoonJson.sunrise);
        const sunsetMinutes  = this.getMinutes(currentMoonJson.sunset);
        if (sunriseMinutes === null || sunsetMinutes === null) {
            this.logger.error(`MoonImage: Could not get the sunrise or sunset values.  Aborting.`);
            return null;
        }
        
        // Shade the background to show day and night
        const sunriseX = sunriseMinutes * (this.moonPlotWidth / 1440);
        const sunsetX = sunsetMinutes * (this.moonPlotWidth / 1440);

        ctx.fillStyle = this.nighttimeColor;
        const nighttimeWidth1 = sunriseMinutes * (this.moonPlotWidth / 1440);
        ctx.fillRect(this.moonPlotX, this.moonPlotY, nighttimeWidth1, this.moonPlotHeight);

        ctx.fillStyle = this.daytimeColor;
        const daytimeWidth = (sunsetMinutes - sunriseMinutes) * (this.moonPlotWidth / 1440);
        ctx.fillRect(this.moonPlotX + sunriseX, this.moonPlotY, daytimeWidth, this.moonPlotHeight);

        ctx.fillStyle = this.nighttimeColor;
        const nighttimeWidth2 = (1440 - sunsetMinutes) * (this.moonPlotWidth / 1440);
        ctx.fillRect(this.moonPlotX + sunsetX, this.moonPlotY, nighttimeWidth2, this.moonPlotHeight);

        // Draw the title
        ctx.fillStyle = this.titleColor;
        ctx.font = extraLargeFont;
        this.centerText(ctx, title, this.imageWidth/2, this.titleY);

        // Draw the date
        ctx.fillStyle = this.labelColor;
        ctx.font = mediumFont;
        ctx.fillText(dateDisplayStr, this.dateX, this.dateY);

        // Draw the big moon
        await this.drawMoon(ctx, currentMoonJson.lunarAgeDays, this.largeMoonX, this.largeMoonY, this.largeMoonSize);

        // Draw the phase string
        ctx.fillStyle = this.labelColor;
        ctx.font = largeFont;
        const phaseStr = `${currentMoonJson.lunarPhase} (${currentMoonJson.lunarIllumination})`;
        ctx.fillText(phaseStr, this.moonPhaseX, this.moonPhaseY);
        
        // Draw the baseline for the moon data
        this.drawChartLine(ctx, 0,  0, this.moonPlotWidth, 0, this.gridColor, this.gridWidth);

        // Draw the vertical lines for the hours
        for (let i = 0; i <= 24; i++) {
            this.drawChartLine(ctx, i * this.moonPlotWidth/24, -10, i * this.moonPlotWidth/24,  10, this.gridColor, this.gridWidth);
        }
        
        for (let i = 0; i <= 24; i = i + 6) {
            this.drawChartLine(ctx, i * this.moonPlotWidth/24, -20, i * this.moonPlotWidth/24,  20, this.gridColor, this.gridWidthMajor);
        }
        
        // Determine each of the 4 cases we need to draw the moon path
        // Case 1: Moon rose and then set on the given day
        // Case 2: Moon set and then later rose on the given day
        // Case 3: Moon rises in a given day but does not set until the next day
        // Case 4: Moon rose the previous day and only sets on the given day
        if (currentMoonRiseMinutes !== null && currentMoonSetMinutes !== null && currentMoonRiseMinutes < currentMoonSetMinutes) {
            this.logger.verbose(`MoonImage: Case 1: Moon rose and then set on the given day`);
            const riseTime = currentMoonRiseMinutes;
            const setTime = currentMoonSetMinutes;

            // Draw this case in a single path
            this.drawMoonPath(ctx, 0, 1440, riseTime, setTime);
            
            const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
            await this.drawMoonOnPath(ctx, nowMinutes, riseTime, setTime, currentMoonJson.lunarAgeDays); 
        } else if (currentMoonRiseMinutes !== null && currentMoonSetMinutes !== null && currentMoonSetMinutes < currentMoonRiseMinutes) {
            this.logger.verbose(`MoonImage: Case 2: Moon set and then later rose on the given day`);
            if (previousMoonRiseMinutes === null) {
                this.logger.error('No previous moon rise time to determine the moon cycle.');
                return null;
            }

            // This is a fudge factor to make the riseTime closer to the actual rise time.  It is a hack.
            // Without it, the riseTime is too early and does not cross the X axis at the right point.
            // This partially addresses the 50 minute difference between the moon cycle and a 24 hour day.
            const case2FudgeFactor = 50;  

            const riseTime = previousMoonRiseMinutes - 1440 + case2FudgeFactor; // Subtract 24 hours to get time on previous day.  It will be negative
            const setTime = currentMoonSetMinutes;

            this.drawMoonPath(ctx, 0, 1440, riseTime, setTime);
            
            const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
            await this.drawMoonOnPath(ctx, nowMinutes, riseTime, setTime, currentMoonJson.lunarAgeDays); 
        } else if (currentMoonRiseMinutes !== null && currentMoonSetMinutes === null) {
            this.logger.verbose(`MoonImage: Case 3: Moon rises in a given day but does not set until the next day`);
            const riseTime = currentMoonRiseMinutes;
            
            if (previousMoonSetMinutes === null || nextMoonSetMinutes === null) {
                this.logger.error('No previous moon set time to determine the moon cycle.');
                return null;
            }
            
            const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

            // For the first segment, use the previous moon set
            let setTime = previousMoonSetMinutes - 1440; // Subtract 24 hours to get time on previous day
            this.drawMoonPath(ctx, 0, riseTime, riseTime, setTime);

            if (nowMinutes <= riseTime) {
                // Draw the moon on the path if it is still before the rise time so we use the first segment setTime
                await this.drawMoonOnPath(ctx, nowMinutes, riseTime, setTime, currentMoonJson.lunarAgeDays); 
            }
            
            // For the second segment, use the next moonset
            setTime = 1440 + nextMoonSetMinutes;

            this.drawMoonPath(ctx, riseTime, 1440, riseTime, setTime);
            if (nowMinutes > riseTime) {
                // Draw the moon on the path if it is after the rise time so we use the second segment setTime
                await this.drawMoonOnPath(ctx, nowMinutes, riseTime, setTime, currentMoonJson.lunarAgeDays); 
            }
        } else if (currentMoonRiseMinutes === null && currentMoonSetMinutes !== null) {
            this.logger.verbose(`MoonImage: Case 4: Moon rose the previous day and only sets on the given day`);

            if (previousMoonRiseMinutes === null || nextMoonRiseMinutes === null) {
                this.logger.error('No previous/next moon rise time to determine the moon cycle.');
                return null;
            }

            const setTime = currentMoonSetMinutes;
            const riseTime = previousMoonRiseMinutes - 1440; // Subtract 24 hours to get time on previous day

            this.drawMoonPath(ctx, 0, 1440, riseTime, setTime);
            
            const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
            await this.drawMoonOnPath(ctx, nowMinutes, riseTime, setTime, currentMoonJson.lunarAgeDays); 
        } else {
            this.logger.error('Insufficient data to plot the moon cycle.  Not one of the 4 cases we need.');
            return null;
        }
       
        if (currentMoonRiseMinutes !== null) {
            const scaledX = currentMoonRiseMinutes * this.moonPlotWidth/1440;
            this.drawChartLine(ctx, scaledX, 50, scaledX, 100, this.labelColor, 2);

            ctx.font = smallFont;
            
            const timeStr = this.formatTime(`${Math.floor(currentMoonRiseMinutes/60)}:${currentMoonRiseMinutes%60}`);
            const timeStrWidth: number = ctx.measureText(timeStr).width;            
            ctx.fillText(timeStr, this.moonPlotX + scaledX - (timeStrWidth/2), this.moonPlotYOrigin + 150);
        }

        if (currentMoonSetMinutes !== null) {
            const scaledX = currentMoonSetMinutes * this.moonPlotWidth/1440;
            this.drawChartLine(ctx, scaledX, 50, scaledX, 100,this.labelColor, 2);
            
            ctx.font = smallFont;  

            const timeStr = this.formatTime(`${Math.floor(currentMoonSetMinutes/60)}:${currentMoonSetMinutes%60}`);
            const timeStrWidth: number = ctx.measureText(timeStr).width;            
            ctx.fillText(timeStr, this.moonPlotX + scaledX - (timeStrWidth/2), this.moonPlotYOrigin + 150);
        }

        const jpegImg = jpeg.encode(img, 80);
        
        return {
            imageData: jpegImg,
            imageType: "jpg"
        };
    }

    // 
    //                             ***
    //                        *          *
    //                    *                  *
    //                 *                        *
    //   ----------- * -------------------------- * ----------- <- Desired X axis
    //     ^       *                                *
    //     Yo     *                                  *
    //     v     *                                    *
    // ---------*----|--------------|-------------|----*---------
    //               R              Pk            S
    //          | Xo |<------------ D ----------->|
    //          |<------ P/4 ------>|
    //
    // Sinnce the amount of time the moon is above the horizon varies, we need to shift the curve up or down to
    // ensure that the moonrise and moonset are on the X axis.  This shift is our Y offset.
    //
    // R - moonRise in minutes from midnight
    // S - moonSet in minutes from midnight
    // P - Period of a day in minutes P/4 = 1440/4 = 360 minutes
    // Pk - Moon peak in minutes from midnight = (R+S)/2
    // D - Duration the moon is above the horizon in minutes = (S-R)
    // Xo - X offset to get R and S to be on the X axis = (P/4 - D/2)
    // Yo - Y offset to shift the curve up or down = sin(x)
    //
    // If we start the curve at the Pk, we can use a cosine function to generate the curve
    // x is in minutes starting at Pk.  We need to device by 4 to get degrees and then convert to radians for the Math.cos() function
    // y = cos((x - Pk)/4 * (Pi/180)).  This works X values less then or greater than Pk.
    //
    // We then scale x and y to do the final plot
    //
    // This solution works well when there is both a moon rise and a moon set in the current day.
    // As you get further from the Pk the duration actually changes causing drift that cause an extra X crossing early or late in a day 
    // that actually appears an a moon rise or moon set in the current day.
    // Case 1 (rise, then set) looks fine plotted all at once since the Pk in in the middle of the day.
    // Case 2 (set and then rise)  also seem to look OK plotted at once.
    // Case 3 (moon rise but no set) This looks best when drawn as 2 segments, before the rise and then after the rise
    // Case 4 (moon set but no rise) This looks OK drawn as a single segment.
    
    /**
     * Draw the moon path, or a segment of the path.  Graph is scaled curveWidth and curveHeight
     * @param ctx 
     * @param startX - Starting time in minutes
     * @param endX - Ending time in minutes
     * @param riseTime - Time the moon rises (prev, current or next depending on the caller) to compute the duration and offsets
     * @param setTime - Time the moon sets, in minutes since midnight.  Used with riseTime to do the offset calculations
     */
    private drawMoonPath(ctx: any, startX: number, endX: number, riseTime: number, setTime: number): void {
        const moonCyclePeriod = (24 * 60) + 0; // 24 hours and 50 minutes

        const moonVisibleDuration = Math.abs(setTime - riseTime);
        const moonPeak = riseTime + moonVisibleDuration/2;
        const xOffset = riseTime - (moonPeak - (moonCyclePeriod/4)); 
        const yOffset = Math.sin((xOffset/4)/(180/Math.PI)) * this.moonPlotAplitude;
        
        this.logger.verbose(`MoonImage: drawMoonPath: Segement ${startX} - ${endX}`);
        this.logger.verbose(`MoonImage: drawMoonPath: Moon Rise: ${riseTime} (${this.minutesToTimeStr(riseTime)})`);
        this.logger.verbose(`MoonImage: drawMoonPath: Moon Set:  ${setTime} (${this.minutesToTimeStr(setTime)})`);
        this.logger.verbose(`MoonImage: drawMoonPath: Moon Visible Duration: ${moonVisibleDuration}`);
        this.logger.verbose(`MoonImage: drawMoonPath: Peak: ${moonPeak} (${this.minutesToTimeStr(moonPeak)})`); 
        this.logger.verbose(`MoonImage: drawMoonPath: Moon Y Offset: ${yOffset}`);
        this.logger.verbose(`MoonImage: drawMoonPath: startX: ${startX}, endX: ${endX}`);

        // Draw the moon path
        ctx.beginPath();
        ctx.lineWidth = this.moonPathWidth;
        ctx.strokeStyle = this.moonPathColor; 

        const cosX = Math.cos((startX - moonPeak)/4 * (Math.PI / 180));
        let y = (cosX * this.moonPlotAplitude) - yOffset;
        ctx.moveTo(this.moonPlotX + startX * this.moonPlotWidth/1440, this.moonPlotYOrigin - y);
        
        for (let x = startX + 1; x <= endX; x++) {
            const cosX = Math.cos((x - moonPeak)/4 * (Math.PI / 180));
            const y = (cosX * this.moonPlotAplitude) - yOffset;
            ctx.lineTo(this.moonPlotX + x * this.moonPlotWidth/1440, this.moonPlotYOrigin - y);
        }

        ctx.stroke();
    }
    
    /**
     * drawMoon - Draw the moon at the specified coordinates
     * @param ctx - Canvas context
     * @param ageDays - Age of the moon in days
     * @param centerX - Center of the moon
     * @param centerY - Center of the moon
     * @param size - Size of the moon
     */
    private drawMoon = async (ctx: any, ageDays: number, centerX: number, centerY: number, size: number) => {
        let moonImageName = this.getMoonImageForAge(ageDays);

        try {
            const readStream = fs.createReadStream(`moon_images/${moonImageName}`);
            let moonImage = await pure.decodePNGFromStream(readStream);
            //this.logger.verbose(`drawMoon: moon image: ${moonImage.width} x ${moonImage.height}`);

            ctx.drawImage(moonImage, 0, 0, moonImage.width, moonImage.height,
                centerX - size/2, centerY - size/2, size, size);
        } catch(err) {
            this.logger.warn(`drawMoon: Failed to draw moon image: ${moonImageName}.  Falling back to a circle`);
            ctx.beginPath();
            ctx.fillStyle = this.moonColor;
                
            ctx.arc(centerX, centerY, size/2, 0, 2 * Math.PI);  // Now draw the sun itself
            ctx.fill();
        }
    }

    /**
     * drawMoonOnPath - Draw the moon on the chart
     * @param ctx    - Canvas context
     * @param time   - time in minutes to draw the moon along the X axis
     * @param riseTime - time the moon rises in minutes
     * @param setTime - time the moon sets in minutes
     * @param age    - age of the moon in days
     */
    private drawMoonOnPath = async (ctx: any, time: number, riseTime: number, setTime: number, age: number) => {
        let moonImageName = this.getMoonImageForAge(age);

        const moonCyclePeriod = (24 * 60) + 0; // 24 hours and 50 minutes

        const moonVisibleDuration = Math.abs(setTime - riseTime);
        const moonPeak = riseTime + moonVisibleDuration/2;
        const xOffset = riseTime - (moonPeak - (moonCyclePeriod/4)); 
        const yOffset = Math.sin((xOffset/4)/(180/Math.PI)) * this.moonPlotAplitude;
        
        const cosX = Math.cos((time - moonPeak)/4 * (Math.PI / 180));
        const y = (cosX * this.moonPlotAplitude) - yOffset;

        // Compute the center of where we want the image to be drawn
        const moonX = (this.moonPlotX + time) * this.moonPlotWidth/1440; // Convert the time to a percentage of the curveWidth
        const moonY = this.moonPlotYOrigin - y;

        try {
            const readStream = fs.createReadStream(`moon_images/${moonImageName}`);
            let moonImage = await pure.decodePNGFromStream(readStream);

            ctx.drawImage(moonImage, 0, 0, moonImage.width, moonImage.height,
                moonX - this.moonRadius, moonY - this.moonRadius, this.moonRadius * 2, this.moonRadius * 2);
        } catch(err) {
            ctx.beginPath();
            ctx.fillStyle = this.moonColor;
                
            ctx.arc(this.moonPlotX + time, this.moonPlotYOrigin - y, this.moonRadius, 0, 2 * Math.PI);  // Now draw the sun itself
           
            ctx.fill();
        }
    }

    /**
     * get a filename for the moon image based on the age of the moon
     * @param ageDays 
     * @returns filename of the moon image
     */
    private getMoonImageForAge = (ageDays: number): string => {
        const MOON_PERIOD_DAYS = 29.53058770576;   // Earth days for one moon cycle

        let moonImageName = "";

        const phaseLength = MOON_PERIOD_DAYS/16; // 8 phases but new is 0-1.8 and 27.7-29.5 days, so split into 16 parts
        if (ageDays < phaseLength)           moonImageName = "new-moon.png";
        else if (ageDays < phaseLength * 3)  moonImageName = "waxing-crescent.png";
        else if (ageDays < phaseLength * 5)  moonImageName = "first-quarter.png";
        else if (ageDays < phaseLength * 7)  moonImageName = "waxing-gibbous"; 
        else if (ageDays < phaseLength * 9)  moonImageName = "full-moon.png";
        else if (ageDays < phaseLength * 11) moonImageName = "waning-crescent.png";
        else if (ageDays < phaseLength * 13) moonImageName = "last-quarter.png";
        else if (ageDays < phaseLength * 15) moonImageName = "waning-crescent.png";
        else                                 moonImageName = "new-moon.png";

        this.logger.verbose(`drawMoon: age: ${ageDays}, image: ${moonImageName}`);

        return moonImageName;
    }

    /**
     * Takes the time ("hh:mm") and converts to minutes (0-1440).  Every minute is 4 degrees
     * @param timeStr (hh:mm)
     * @returns value in minutes, or null for "-:-" (no rise or set that day).
     */
    private getMinutes(timeStr: string): number | null {
        if (timeStr === "-:-") {
            return null;
        }

        const timeElements: Array<string> = timeStr.split(":");
        if (timeElements.length < 2 ||
            isNaN(Number(timeElements[0])) ||
            isNaN(Number(timeElements[1])) ||
            Number(timeElements[0]) < 0 ||
            Number(timeElements[0]) > 23 ||
            Number(timeElements[1]) < 0 ||
            Number(timeElements[1]) > 59) {
            this.logger.warn(`MoonImage: getMinutes() failed on input "${timeStr}"`);
            return null;
        }

        return +timeElements[0] * 60 + +timeElements[1];
    }

    /**
     * This optimized fillRect was derived from the pureimage source code: https://github.com/joshmarinacci/node-pureimage/tree/master/src
     * To fill a 1920x1080 image on a core i5, this saves about 1.5 seconds
     * @param img Target image to draw on
     * @param x Position of the rect X
     * @param y Position of the rect Y
     * @param w Width of the rect
     * @param h Hieght of the rect
     * @param rgb Color in the form "#rrggbb"
     * @returns void
     */
    // xeslint-disable-next-line @typescript-eslint/no-explicit-any
    private myFillRect(img: ImageBuffer, x: number, y: number, w: number, h: number, rgb: string): void {
        const colorValue = parseInt(rgb.substring(1), 16);

        // the shift operator forces js to perform the internal ToUint32 (see ecmascript spec 9.6)
        //colorValue = colorValue >>> 0;
        const r = (colorValue >>> 16) & 0xFF;
        const g = (colorValue >>> 8)  & 0xFF;  
        const b = (colorValue)        & 0xFF;
        const a = 0xFF;

        for(let i = y; i < y + h; i++) {                
            for(let j = x; j < x + w; j++) {   
                const index = (i * img.width + j) * 4;   
                
                img.data[index + 0] = r;
                img.data[index + 1] = g;     
                img.data[index + 2] = b;     
                img.data[index + 3] = a; 
            }
        }
    }

    /**
     * Helper method to center text on the canvas
     * @param ctx - Context of the canvas
     * @param text - Text to center
     * @param x - X position to center the text
     * @param y - Y position to center the text
     * @returns void
     */
    private centerText(ctx: any, text: string, x: number, y: number): void {
        const width = ctx.measureText(text).width;
        ctx.fillText(text, x - width/2, y);
    }
    
    /**
     * drawLine - Draw a line on the chart
     * @param ctx    - Canvas context
     * @param startX      - x position of the line (Relative to the chartOriginX) 
     * @param startY      - y position of the line (Relative to the chartOriginY)
     * @param endX        - x position of the line (Relative to the chartOriginX) 
     * @param endY        - y position of the line (Relative to the chartOriginY)
     * @param color       - color string for the line
     * @param width       - width of the line
     * @returns void
     */
    private drawChartLine = (ctx: any, startX: number, startY: number, endX: number, endY: number, color: string, width: number): void => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(this.moonPlotX + startX, this.moonPlotYOrigin + startY);
        ctx.lineTo(this.moonPlotX + endX, this.moonPlotYOrigin + endY);
        ctx.stroke();
    };
        
    /**
     * Convert minutes (from midnight) to a time in HH:MM format
     * @param minutes 
     * @returns 
     */
    private minutesToTimeStr(minutes: number): string {
        const hours = Math.floor(minutes / 60);
        const mins = Math.floor(minutes % 60);
        return `${hours}:${mins}`;
    }

    /**
     * Formats the time for display.  For "22:45" returns "10:45 PM"
     * @param timeStr time in 24 hour format (hh:mm or hh:mm:ss, hh:mm:ss:nnn)
     * @returns Formatted string in 12 hour time with AM/PM 
     */
    private formatTime(timeStr: string): string {
        const timeElements: Array<string> = timeStr.split(":");
        if (timeElements.length < 2 ||
            isNaN(Number(timeElements[0])) ||
            isNaN(Number(timeElements[1])) ||
            Number(timeElements[0]) < 0 ||
            Number(timeElements[0]) > 23 ||
            Number(timeElements[1]) < 0 ||
            Number(timeElements[1]) > 59) {
            this.logger.warn(`MoonImage: formatTime() failed on input "${timeStr}"`);
            return "";
        }
        let hour = +timeElements[0] % 12;
        if (hour === 0)
            hour = 12;
        
        const min = +timeElements[1];

        //const hourStr = (hour < 10) ? `0${hour}` : `${hour}`;
        const minStr  = (min < 10)  ? `0${min}`  : `${min}`;
        const amPmStr = (+timeElements[0] > 11) ? "PM" : "AM";
        return `${hour}:${minStr} ${amPmStr}`;
    }
}
