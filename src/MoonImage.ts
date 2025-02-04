/* eslint-disable @typescript-eslint/no-unused-vars */
import jpeg from "jpeg-js";
import path from "path";
import * as pure from "pureimage";

import { MoonData, MoonJson } from "./MoonData";
import { LoggerInterface } from "./Logger";
import { KacheInterface} from "./Kache";
import { relativeTimeThreshold } from "moment";

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
    
    private curveWidth: number;
    private curveHeight: number;

    private dateX: number;
    private dateY: number;
    private titleY: number;

    private backgroundColor: string;
    private titleColor: string;
    private labelColor: string;
    private gridColor: string;
    private gridWidth: number;
    private moonXOrigin: number;
    private moonYOrigin: number;
    private moonPathColor: string;
    private moonPathWidth: number;
    private moonColor: string;
    private moonRadius: number;

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

        this.curveWidth = 1440;                                                          // Smaller than the imageWidth but must be a multiple of hoursToShow
        this.curveHeight = 150;  

        this.backgroundColor = "#e0e0e0";              // format needed by myFillRect
        this.titleColor      = "#2020B0"; 
        this.labelColor      = "#2020B0";
        this.gridColor       = "#A0A0A0";
        this.gridWidth       = 3;
        this.moonXOrigin     = 200;
        this.moonYOrigin     = 500;
        this.moonPathColor   = "#666";
        this.moonPathWidth   = 4;
        this.moonColor       = "#666"; //"#303030";
        this.moonRadius      = 40;                     
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    

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
                
        const largeFont                 = "72px 'OpenSans-Bold'";     // Title
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

        const currentMoonJson: MoonJson | null = await  moonData.getMoonData(lat, lon, apiKey, timeZone, dateStr);

        if (currentMoonJson === null) {
            this.logger.error(`MoonImage: getImage() failed to get data for ${location} on ${dateStr}`);
            return null;
        }

        const currentMoonRiseMinutes: number | null = this.getMinutes(currentMoonJson.moonrise);
        const currentMoonSetMinutes: number | null = this.getMinutes(currentMoonJson.moonset);

        this.logger.verbose(`MoonImage: Current Moon Rise: ${currentMoonJson.moonrise} = ${currentMoonRiseMinutes !== null ? currentMoonRiseMinutes : "null"}`);
        this.logger.verbose(`MoonImage: Current Moon Set:  ${currentMoonJson.moonset}  = ${currentMoonSetMinutes !== null ? currentMoonSetMinutes : "null"}`); 

        const previousMoonJson = await moonData.getMoonData(lat, lon, apiKey, timeZone, dateStr, true); // true to get the previous day's data

        if (previousMoonJson === null) {
            this.logger.error(`MoonImage: getImage() failed to get data for ${location} on ${dateStr}`);
            return null;
        }

        const previousMoonRiseMinutes: number | null = this.getMinutes(previousMoonJson.moonrise);
        const previousMoonSetMinutes: number | null = this.getMinutes(previousMoonJson.moonset);

        this.logger.verbose(`MoonImage: Previous Moon Rise: ${previousMoonJson.moonrise} = ${previousMoonRiseMinutes !== null ? previousMoonRiseMinutes : "null"}`);
        this.logger.verbose(`MoonImage: Previous Moon Set:  ${previousMoonJson.moonset}  = ${previousMoonSetMinutes !== null ? previousMoonSetMinutes : "null"}`); 
        
        // Moon cycle period in minutes
        const moonCyclePeriod = (24 * 60) + 0; // 24 hours and 50 minutes

        // Determine which rise and set times to use based on the cases
        let riseTime: number | null = null;
        let setTime: number | null = null;
        let moonVisibleDuration: number = 0;
        let moonHiddenDuration: number = 0;
        let moonPeak: number = 0;
        let yOffset: number = 0;

        // Case 1: Moon rose and then set on the given day
        if (currentMoonRiseMinutes !== null && currentMoonSetMinutes !== null && currentMoonRiseMinutes < currentMoonSetMinutes) {
            this.logger.verbose(`MoonImage: Case 1: Moon rose and then set on the given day`);
            riseTime = currentMoonRiseMinutes;
            setTime = currentMoonSetMinutes;
            moonVisibleDuration = currentMoonSetMinutes - currentMoonRiseMinutes;
            moonPeak = currentMoonRiseMinutes + moonVisibleDuration/2;
            const x = riseTime - (moonPeak - (moonCyclePeriod/4)); 
            yOffset = Math.sin((x/4)/(180/Math.PI)) * this.curveHeight;
        }
        // Case 2: Moon set and then later rose on the given day
        else if (currentMoonRiseMinutes !== null && currentMoonSetMinutes !== null && currentMoonSetMinutes < currentMoonRiseMinutes) {
            this.logger.verbose(`MoonImage: Case 2: Moon set and then later rose on the given day`);
            if (previousMoonRiseMinutes === null) {
                this.logger.error('No previous moon rise time to determine the moon cycle.');
                return null;
            }

            // This is a fudge factor to make the riseTime closer to the actual rise time.  It is a hack.
            // Without it, the riseTime is too early and the does not cross the X axis at the right point.
            // 50 of this fudge factor is to account for the 50 minute difference between the moon cycle and a 24 hour day.
            const case2FudgeFactor = 70; 

            riseTime = previousMoonRiseMinutes - 1440 + case2FudgeFactor; // Subtract 24 hours to get time on previous day.  It will be negative
            setTime = currentMoonSetMinutes;
            
            moonVisibleDuration = setTime - riseTime;
            moonHiddenDuration = riseTime - setTime;
            moonPeak = riseTime + moonVisibleDuration/2;
            const x = riseTime - (moonPeak - (moonCyclePeriod/4)); 
            yOffset = Math.sin((x/4)/(180/Math.PI)) * this.curveHeight;
        }
        // Case 3: Moon rises in a given day but does not set until the next day
        else if (currentMoonRiseMinutes !== null && currentMoonSetMinutes === null) {
            this.logger.verbose(`MoonImage: Case 3: Moon rises in a given day but does not set until the next day`);
            riseTime = currentMoonRiseMinutes;
            
            if (previousMoonSetMinutes === null) {
                this.logger.error('No previous moon set time to determine the moon cycle.');
                return null;
            }
            
            setTime = previousMoonSetMinutes - 1440; // Subtract 24 hours to get time on previous day

            moonVisibleDuration = (riseTime - setTime);
            moonPeak = riseTime + moonVisibleDuration/2;
            const x = riseTime - (moonPeak - (moonCyclePeriod/4)); 
            yOffset = Math.sin((x/4)/(180/Math.PI)) * this.curveHeight;
        }
        // Case 4: Moon rose the previous day and only sets on the given day
        else if (currentMoonRiseMinutes === null && currentMoonSetMinutes !== null) {
            this.logger.verbose(`MoonImage: Case 4: Moon rose the previous day and only sets on the given day`);

            if (previousMoonRiseMinutes === null) {
                this.logger.error('No previous moon rise time to determine the moon cycle.');
                return null;
            }

            // This is a fudge factor to make the riseTime closer to the actual rise time.  It is a hack.
            // Without it, the riseTime is too early and the does not cross the X axis at the right point
            const case4FudgeFactor = 10; 

            riseTime = previousMoonRiseMinutes - 1440 + case4FudgeFactor; // Subtract 24 hours to get time on previous day
            setTime = currentMoonSetMinutes;

            moonVisibleDuration = setTime - riseTime;
            moonPeak = riseTime + moonVisibleDuration/2;
            const x = riseTime - (moonPeak - (moonCyclePeriod/4)); 
            yOffset = Math.sin((x/4)/(180/Math.PI)) * this.curveHeight;

        } else {
            this.logger.error('Insufficient data to plot the moon cycle.  Not one of the 4 cases we need.');
            return null;
        }

        if (riseTime === null || setTime === null) {
            this.logger.error('Failed to determine rise and set times.');
            return null;
        }

        if (moonVisibleDuration === null || moonPeak === null) {
            this.logger.error('Cannot determine moon duration or peak time.');
            return null;
        }

        this.logger.verbose(`MoonImage: Computed Moon Rise: ${riseTime}`);
        this.logger.verbose(`MoonImage: Computed Moon Set:  ${setTime}`);
        this.logger.verbose(`MoonImage: Computed Moon Visible Duration: ${moonVisibleDuration}`);
        this.logger.verbose(`MoonImage: Computed Moon Hidden Duration: ${moonHiddenDuration}`);
        this.logger.verbose(`MoonImage: Computed Moon Peak: ${moonPeak}`);
        this.logger.verbose(`MoonImage: Computed Moon Y Offset: ${yOffset}`);

        // We have all the data we need.  Create the image
        const img = pure.make(this.imageWidth, this.imageHeight);
        const ctx = img.getContext("2d");

        const dataDate        = new Date(currentMoonJson.date + "T00:00:00"); // Without the explicit time, Date.Parse assume this is UTC and the day is off by 1.
        const title           = `Moon Times for ${location}`;
        const dateDisplayStr  = `${moment(dataDate).format("MMM D, YYYY")}`;

        // Extend ctx with function to draw centered text
        ctx.centerText = function(text: string, x: number, y: number): void {
            const width = this.measureText(text).width;
            this.fillText(text, x - width/2, y);
        };

        // Fill the background
        //ctx.fillStyle = backgroundColor;
        //ctx.fillRect(0, 0, imageWidth, imageHeight);
        this.myFillRect(img, 0, 0, this.imageWidth, this.imageHeight, this.backgroundColor);

        // Draw the title
        ctx.fillStyle = this.titleColor;
        ctx.font = largeFont;
        const textWidth: number = ctx.measureText(title).width;
        ctx.fillText(title, (this.imageWidth - textWidth) / 2, this.titleY);

        // Draw the date
        ctx.fillStyle = this.labelColor;
        ctx.font = mediumFont;
        ctx.fillText(dateDisplayStr, this.dateX, this.dateY);

        // Draw the baseline for the moon data
        this.drawChartLine(ctx, 0,  0, this.curveWidth, 0, this.gridColor, this.gridWidth);

        // Draw the vertical lines for the hours
        for (let i = 0; i <= 24; i++) {
            this.drawChartLine(ctx, i * this.curveWidth/24, -10, i * this.curveWidth/24,  10, this.gridColor, this.gridWidth);
        }
        
        for (let i = 0; i <= 24; i = i + 6) {
            this.drawChartLine(ctx, i * this.curveWidth/24, -20, i * this.curveWidth/24,  20, this.gridColor, this.gridWidth);
        }
        
        // Draw the moon path
        ctx.beginPath();
        ctx.lineWidth = this.moonPathWidth;
        ctx.strokeStyle = this.moonPathColor; 

        let x = 0;
        const cosX = Math.cos((x - moonPeak)/4 * (Math.PI / 180));
        let y = (cosX * this.curveHeight) - yOffset;
        ctx.moveTo(this.moonXOrigin + x, this.moonYOrigin - y);
        for (let x = 0; x <= 1440; x++) {
            const cosX = Math.cos((x - moonPeak)/4 * (Math.PI / 180));
            const y = (cosX * this.curveHeight) - yOffset;
            ctx.lineTo(this.moonXOrigin + x, this.moonYOrigin - y);
        }

        ctx.stroke();

        if (currentMoonRiseMinutes !== null) {
            this.drawChartLine(ctx, currentMoonRiseMinutes, 50, currentMoonRiseMinutes, 100, this.labelColor, 2);

            ctx.font = smallFont;
            
            const label = "Rise";
            const textWidth: number = ctx.measureText(label).width;
            //ctx.fillText(label, this.moonXOrigin + currentMoonRiseMinutes - (textWidth/2), this.moonYOrigin + (this.curveHeight) + 150);
            
            const timeStr = this.formatTime(`${Math.floor(currentMoonRiseMinutes/60)}:${currentMoonRiseMinutes%60}`);
            const timeStrWidth: number = ctx.measureText(timeStr).width;            
            ctx.fillText(timeStr, this.moonXOrigin + currentMoonRiseMinutes - (timeStrWidth/2), this.moonYOrigin + 150);
        }

        if (currentMoonSetMinutes !== null) {
            this.drawChartLine(ctx, currentMoonSetMinutes, 50, currentMoonSetMinutes, 100,this.labelColor, 2);
            
            ctx.font = smallFont;            
            
            const label = "Set";
            const textWidth: number = ctx.measureText(label).width;
            //ctx.fillText(label, this.moonXOrigin + currentMoonSetMinutes - (textWidth/2), this.moonYOrigin + (this.curveHeight) + 150);
            
            const timeStr = this.formatTime(`${Math.floor(currentMoonSetMinutes/60)}:${currentMoonSetMinutes%60}`);
            const timeStrWidth: number = ctx.measureText(timeStr).width;            
            ctx.fillText(timeStr, this.moonXOrigin + currentMoonSetMinutes - (timeStrWidth/2), this.moonYOrigin + 150);
        }

        const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
        this.drawMoon(ctx, nowMinutes, moonPeak, yOffset); 

        const jpegImg = jpeg.encode(img, 80);
        
        return {
            imageData: jpegImg,
            imageType: "jpg"
        };
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
    private drawChartLine = (ctx: any, startX: number, startY: number, endX: number, endY: number, color: string, width: number) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(this.moonXOrigin + startX, this.moonYOrigin + startY);
        ctx.lineTo(this.moonXOrigin + endX, this.moonYOrigin + endY);
        ctx.stroke();
    };
    
    /**
     * drawMoon - Draw the moon on the chart
     * @param ctx    - Canvas context
     * @param time   - time in minutes to draw the moon along the X axis
     * @param moonPeak - time in minutes when the moon is at its peak
     * @param yOffset - offset to draw the moon along the Y axis
     */
    private drawMoon = (ctx: any, time: number, moonPeak: number, yOffset: number) => {
        
        const cosX = Math.cos((time - moonPeak)/4 * (Math.PI / 180));
        const y = (cosX * this.curveHeight) - yOffset;

        ctx.beginPath();
        ctx.fillStyle = this.moonColor;
            
        ctx.arc(this.moonXOrigin + time, this.moonYOrigin - y, this.moonRadius, 0, 2 * Math.PI);  // Now draw the sun itself
        ctx.fill();
    };

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
            this.logger.warn(`MoonImage: formatTime() failed on input "${timeStr}`);
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
