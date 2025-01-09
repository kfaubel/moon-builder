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
    private chartOriginX: number;
    private chartOriginY: number;
    private chartWidth: number;
    private chartHeight: number;

    private backgroundColor: string;
    private gridColor: string;
    private sineColor: string;
    private sineWaveHeight: number;
    private sineWaveWidth: number;
    private moonXOrigin: number;
    private moonYOrigin: number;
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

        // Screen origin is the upper left corner
        this.chartOriginX = 100;                                                         // In from the left edge
        this.chartOriginY = this.imageHeight - 30;    

        this.chartWidth = 1680;                                                          // Smaller than the imageWidth but must be a multiple of hoursToShow
        this.chartHeight = 900;  

        this.backgroundColor = "#e0e0e0";              // format needed by myFillRect
        this.gridColor = "#707070";
        this.sineColor = "#B0B0B0";
        this.sineWaveHeight = 100;
        this.sineWaveWidth = 1440;                     // 24 hours * 60 minutes
        this.moonXOrigin = 100;
        this.moonYOrigin = 400
        this.moonColor = "#303030";
        this.moonRadius = 20;                     


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
        
        const lunarDayLengthMinutes = 24 * 60 + 50; // Lunar day is 24 hours and 50 minutes

        const moonData: MoonData = new MoonData(this.logger, this.cache);

        const moonJson: MoonJson | null = await  moonData.getMoonData(lat, lon, apiKey, timeZone, dateStr);

        if (moonJson === null) {
            this.logger.error(`MoonImage: getImage() failed to get data for ${location} on ${dateStr}`);
            return null;
        }

        const moonRiseMinutes: number | null = this.getMinutes(moonJson.moonrise);
        const moonSetMinutes: number | null = this.getMinutes(moonJson.moonset);

        this.logger.info(`MoonImage: getImage() moonRiseMinutes: ${moonRiseMinutes !== null ? moonRiseMinutes : "null"}`);
        this.logger.info(`MoonImage: getImage() moonSetMinutes: ${moonSetMinutes !== null ? moonSetMinutes : "null"}`);

        // We have 4 cases to consider:
        // 1. Moonrise and moonset are both today and moonrise is before moonset (e.g.: New moon)
        //    * This is simple, we can start the graph at (-moonrise)
        //    * We also know the duration of the moon above the horizon to adjust the graph up and down
        // 2. Moonrise and moonset are both today and moonrise is after moonset (e.g.: Full moon)
        //    * We can figure out when the previous moonrise was based on the moonset and the duration of the moon above the horizon
        // 3. Only a moonrise today 
        //    * We need to use the previous day's moonset to calculate the duration of the moon above the horizon
        // 4. Only a moonset today
        //    * We need to use the previous day's moonrise to calculate the duration of the moon above the horizon
        
        let previousMoonRiseMinutes: number | null = null;
        let previousMoonSetMinutes: number | null = null;
        let moonAboveHorizonMinutes = 0;
        let moonMinutesOffset = 0;

        if (moonRiseMinutes !== null && moonSetMinutes !== null) {
            if (moonRiseMinutes < moonSetMinutes) {
                // Case 1: Moonrise and moonset are both today and moonrise is before moonset
                moonAboveHorizonMinutes = moonSetMinutes - moonRiseMinutes;
                moonMinutesOffset = - (moonRiseMinutes);

                this.logger.verbose(`MoonImage: getImage() Case 1: Moonrise and moonset are both today and moonrise is before moonset`);
                this.logger.verbose(`MoonImage: getImage() moonAboveHorizonMinutes: ${moonAboveHorizonMinutes}`);                
                this.logger.verbose(`MoonImage: getImage() moonMinutesOffset: ${moonMinutesOffset}`);
            } else {
                // Case 2: Moonrise and moonset are both today and moonrise is after moonset
                // moon below the hoizon is: moonRiseMinutes - moonSetMinutes
                // moon above the horizon is: lunarDayLengthMinutes - (moon below the horizon in minutes)
                moonAboveHorizonMinutes = lunarDayLengthMinutes - (moonRiseMinutes - moonSetMinutes);
                // moonMinutesOffset = - (moonRiseMinutes - moonAboveHorizonMinutes);
                moonMinutesOffset = - (moonRiseMinutes);



                // moonAboveHorizonMinutes is 828, should be around 650

                this.logger.verbose(`MoonImage: getImage() Case 2: Moonrise and moonset are both today and moonrise is after moonset`);
                this.logger.verbose(`MoonImage: getImage() moonAboveHorizonMinutes: ${moonAboveHorizonMinutes}`);
                this.logger.verbose(`MoonImage: getImage() moonMinutesOffset: ${moonMinutesOffset}`);
            }
            
        } else if (moonSetMinutes === null && moonRiseMinutes !== null) {
            // Case 3: Only a moonrise today
            // If there is no moonset, we need to use the previous day's moonrise
            const previousMoonJson = await moonData.getMoonData(lat, lat, apiKey, timeZone, "yesterday");
            if (previousMoonJson === null) {
                this.logger.error(`MoonImage: getImage() failed to get previous data for ${location} on ${dateStr} "yesterday"`);
                return null;
            }
            previousMoonSetMinutes = this.getMinutes(previousMoonJson.moonset);
            if (previousMoonSetMinutes === null) {
                this.logger.error(`MoonImage: getImage() failed to get previous moonrise minutes from ${previousMoonJson.moonset}`);
                return null;
            }

            // Add the part of lunar night from yesterday to the lunar night today.  Then subtract from the length of the lunar day   
            moonAboveHorizonMinutes = lunarDayLengthMinutes - ((lunarDayLengthMinutes) - previousMoonSetMinutes) + moonRiseMinutes;
            moonMinutesOffset = - ((lunarDayLengthMinutes - moonAboveHorizonMinutes) + moonRiseMinutes);

            this.logger.verbose(`MoonImage: getImage() Case 3: Only a moonrise today`);
            this.logger.verbose(`MoonImage: getImage() moonAboveHorizonMinutes: ${moonAboveHorizonMinutes}`);
            this.logger.verbose(`MoonImage: getImage() moonMinutesOffset: ${moonMinutesOffset}`);
        } else if (moonRiseMinutes === null && moonSetMinutes !== null) {
            // Case 4: Only a moonset today
           
            // If there is no moonrise, we need to use the previous day's moonrise
            const previousMoonJson = await moonData.getMoonData(lat, lat, apiKey, timeZone, "yesterday");
            if (previousMoonJson === null) {
                this.logger.error(`MoonImage: getImage() failed to get data for ${location} on ${dateStr} "yesterday"`);
                return null;
            }
            previousMoonRiseMinutes = this.getMinutes(previousMoonJson.moonrise);
            if (previousMoonRiseMinutes === null) {
                this.logger.error(`MoonImage: getImage() failed to get moonrise from ${previousMoonJson.moonrise}`);
                return null;
            }

            // Add the part of the lunar day from yesterday's moonrise until midnight plus today's minutes until moonset
            moonAboveHorizonMinutes = ((lunarDayLengthMinutes) - previousMoonRiseMinutes) + moonSetMinutes; 
            moonMinutesOffset = - (lunarDayLengthMinutes - previousMoonRiseMinutes);

            this.logger.verbose(`MoonImage: getImage() Case 4: Only a moonset today`);
            this.logger.verbose(`MoonImage: getImage() moonAboveHorizonMinutes: ${moonAboveHorizonMinutes}`);
            this.logger.verbose(`MoonImage: getImage() moonMinutesOffset: ${moonMinutesOffset}`);
        } else {
            // Case X: The moon disappeared!
            this.logger.error(`MoonImage: getImage() failed to get either a moonrise and moonset for ${location} on ${dateStr}.  Moon disappeared!`);
            return null;
        }
        
        

        // We need to draw a sine wave with a period of the lunar day (24 hours and 50 minutes)

        

        
        
        
        const twilightDegrees          = 24;     // 24 degrees before sunrise and 24 degrees after sunset
        const twilightMinutes          = 24 * 4; // 4 minutes per degree (96 minutes)

        const dataDate        = new Date(moonJson.date + "T00:00:00"); // Without the explicit time, Date.Parse assume this is UTC and the day is off by 1.
        const title           = `Sun & Moon Times for ${location}`;
        const dateDisplayStr  = `${dataDate.toLocaleString()}`;

        // Define layout constants
        const imageHeight              = 1080; 
        const imageWidth               = 1920; 

        const centerX                  = imageWidth/2;
        const centerY                  = imageHeight/2 + 40;     // leave some extra room at the top for the title
        const sunCircleRadius          = 380; //imageHeight/3;          //360
        const moonCircleRadius         = 300; //imageHeight/4;          //270
        const sunArcWidth              = 20;
        const moonArcWidth             = 33;
        const sunRadius                = 35;                     // The actual sun drawn on the circle
        const moonRadius               = 35;

        const backgroundColor          = "#FFFFFA";              // format needed by myFillRect
        const circleColor              = "#B0B0B0";
        const timeLabelColor           = "#B0B0B0"; 
        const tickColor                = "#B0B0B0";
        const sunCircleColor           = "#504773"; //"#303050";
        const sunArcColor              = "#FCD303";
        const sunUpColor               = "#FDF000";
        const sunDownColor             = "#D1AF02";
        const sunTwilightArcColor1     = "#F0E000";
        const sunTwilightArcColor2     = "#B80010";
        const sunTwilightArcColor3     = "#7a2100"; //"#500028";
        const solidTwilightArcColor    = "#d45b0b";
        const moonArcColor             = "#D0D0D0";
        const moonUpColor              = "#707070";
        const moonDownColor            = "#808080";
        const moonLabelColor           = "#707070";
        const titleColor               = "#2020F0"; 
        const labelColor               = "#2020F0";
        
        // Approximation of the height of a capital letter
        const largeFontCharHeight       = 54;
        const mediumFontCharHeight      = 40;
        const smallFontCharHeight       = 30;
        const xsmallFontCharHeight      = 22;

        const largeFont                 = "72px 'OpenSans-Bold'";     // Title
        const mediumFont                = "48px 'OpenSans-Regular";   // Other text
        const smallFont                 = "40px 'OpenSans-Regular'";  // Note at the bottom
        const extraSmallFont            = "30px 'OpenSans-Regular'";  // Note at the bottom

        // When used as an npm package, fonts need to be installed in the top level of the main project
        const fntBold     = pure.registerFont(path.join(".", "fonts", "OpenSans-Bold.ttf"),"OpenSans-Bold");
        const fntRegular  = pure.registerFont(path.join(".", "fonts", "OpenSans-Regular.ttf"),"OpenSans-Regular");
        const fntRegular2 = pure.registerFont(path.join(".", "fonts", "alata-regular.ttf"),"alata-regular");
        
        fntBold.loadSync();
        fntRegular.loadSync();
        fntRegular2.loadSync();

        const titleY                    = 90; // down from the top of the image

        const moonValuesSpacingY        = 60;
        
        const moonLabelX                = centerX - 180;
        const moonValueX                = centerX - 40;

        const moonHeaderY               = centerY - 140;
        const moonriseLabelY            = centerY - 60;
        const moonsetLabelY             = moonriseLabelY + moonValuesSpacingY;
        const moonAgeLabelY             = moonriseLabelY + moonValuesSpacingY * 2;
        const moonPhaseLabelY           = moonriseLabelY + moonValuesSpacingY * 3;

        const dateX                     = imageWidth * 3/4;
        const dateY                     = imageHeight - 20;

        const img = pure.make(imageWidth, imageHeight);
        const ctx = img.getContext("2d");

        // Extend ctx with function to dray centered text
        ctx.centerText = function(text: string, x: number, y: number): void {
            const width = this.measureText(text).width;
            this.fillText(text, x - width/2, y);
        };

        // Fill the background
        //ctx.fillStyle = backgroundColor;
        //ctx.fillRect(0, 0, imageWidth, imageHeight);
        this.myFillRect(img, 0, 0, imageWidth, imageHeight, this.backgroundColor);

        // Draw the title
        ctx.fillStyle = titleColor;
        ctx.font = mediumFont;
        const textWidth: number = ctx.measureText(title).width;
        ctx.fillText(title, (imageWidth - textWidth) / 2, titleY);

        // Draw the baseline for the moon data
        this.drawLine(ctx, this.moonXOrigin,  this.moonYOrigin, 1540, 400, this.gridColor, 1);

        for (let i = 0; i <= 24; i++) {
            this.drawLine(ctx, this.moonXOrigin + i * this.sineWaveWidth/24,  this.moonYOrigin - 10, 100 + i * this.sineWaveWidth/24,  this.moonYOrigin + 10, this.gridColor, 1);
        }
        
        for (let i = 0; i <= 24; i = i + 12) {
            this.drawLine(ctx, this.moonXOrigin + i * this.sineWaveWidth/24,  this.moonYOrigin - 20, 100 + i * this.sineWaveWidth/24,  this.moonYOrigin + 20, this.gridColor, 1);
        }
        
        this.logger.verbose(`MoonImage: Moon above horizon: ${moonAboveHorizonMinutes} minutes`);



        //moonAboveHorizonMinutes = lunarDayLengthMinutes/2;
        const ratio = moonAboveHorizonMinutes/(lunarDayLengthMinutes/2);
        this.logger.verbose(`MoonImage: ratio: ${ratio}`);
        const a = 1 - Math.sin((ratio) * (180/Math.PI));
        this.logger.verbose(`MoonImage: a: ${a}`);


        const yOffset = (1 - ratio) * this.sineWaveHeight;     //-a * this.sineWaveHeight; //Math.sin((moonMinutesOffset/4 - 90)/(180/Math.PI)) * this.sineWaveHeight;
        this.logger.verbose(`MoonImage: Moon yOffset: ${yOffset}`);
        ctx.strokeStyle = this.sineColor;
        ctx.lineWidth = 2
        this.drawSine(ctx, this.moonXOrigin, this.moonYOrigin, this.sineWaveWidth, this.sineWaveHeight, lunarDayLengthMinutes, moonMinutesOffset, yOffset);

        const currentHour = moment.tz(timeZone).hour();  
        const currentMinute = moment.tz(timeZone).minute();  
        this.logger.verbose(`WeatherImage: Current hour: ${currentHour}, minute: ${currentMinute} in location timezone: ${timeZone}`); 

        //private drawSun = (ctx: any, originX: number, originY: number, width: number, height: number, sunPositionMinutes: number, color: string) => {
     
        //this.drawSun(ctx, this.sunXOrigin, this.sunYOrigin+ sunGraphYAdjustment, this.sineWaveWidth, this.sineWaveHeight, currentHour * 60 + currentMinute, this.sunColor);

        // Draw the baseline for the moon data
        //this.drawLine(ctx, this.sunXOrigin, 800, 1540, 800, this.gridColor, 2);

        //this.drawlSine(ctx, 100, 800, 1800, this.sineColor, 4);

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
            this.logger.warn(`MoonImage: getAngle() failed on input "${timeStr}"`);
            return null;
        }

        const minutes = +timeElements[0] * 60 + +timeElements[1];
        
        return minutes;
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
     */
    // xeslint-disable-next-line @typescript-eslint/no-explicit-any
    private myFillRect(img: ImageBuffer, x: number, y: number, w: number, h: number, rgb: string) {
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
     * drawLine Draw a line on the chart
     * @param ctx    - Canvas context
     * @param x      - x position of the line (Relative to the chartOriginX) 
     * @param color 
     * @param width 
     */
    private drawLine = (ctx: any, startX: number, startY: number, endX: number, endY: number, color: string, width: number) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    };

    /**
     * drawSine Draw a sine wave on the chart
     * @param ctx    - Canvas context (set the stroke style and line width before calling this function)
     * @param originX - x position of the line (Relative to the chartOriginX)
     * @param originY - y position of the line (Relative to the chartOriginY)
     * @param height  - height of the sine wave (0 - peak) in pixels
     * @param width   - width of the sine wave in pixels (e.g.: 1440)
     * @param periodMinutes   - width of the sine wave (e.g.: 1440 for the sun, 1490 for the moon)
     * @param xOffset  - x position of the line (in minutes)
     * @param yOffset - y offset of the sine wave used to adjust the graph up and down (possitive moves the graph up)
     */
    private drawSine = (ctx: any, originX: number, originY: number, width: number, height: number, 
                        periodMinutes: number, xOffset: number, yOffset: number) => {
        const minutesPerDegree = width/360;  // (typically 4)
        const degreesPerRadian = 180/Math.PI;

        ctx.beginPath();
        const y0 = originY + yOffset - Math.sin((xOffset/4)/(180/Math.PI)) * height;

        ctx.moveTo(originX, y0);

        for (let i = 1; i <= width; i++) {
            const x = originX + i;
            //const y = originY + yOffset - Math.sin(((xOffset + i)/4)/(180/Math.PI)) * height;
            const y = originY + yOffset - Math.sin((xOffset + i)/minutesPerDegree/degreesPerRadian) * height;
            ctx.lineTo(x, y);
        }
        
        ctx.stroke();
    };
    
    /**
     * drawVerticalLine Draw a vertical line on the chart
     * @param ctx    - Canvas context
     * @param originX - x position of the line (Relative to the chartOriginX)
     * @param originY - y position of the line (Relative to the chartOriginY)
     * @param width   - width of the sine wave
     * @param height  - height of the sine wave
     * @param sunPositionMinutes  - x position of the line (in minutes)
     * @param color   - color of the line     * 
     */
    private drawMoon = (ctx: any, originX: number, originY: number, width: number, height: number, sunPositionMinutes: number, color: string) => {
        
        ctx.beginPath();
        
        const x = originX + sunPositionMinutes;
        const y = originY - Math.sin((sunPositionMinutes/4 - 90)/(180/Math.PI)) * height;
            
        ctx.arc(x, y, this.moonRadius, 0, 2 * Math.PI);  // Now draw the sun itself
        ctx.fill();
    };
    
    /**
     * drawVerticalLine Draw a vertical line on the chart
     * @param ctx    - Canvas context
     * @param x      - x position of the line (Relative to the chartOriginX) 
     * @param color 
     * @param width 
     */
    private drawChartVerticalLine = (ctx: any, x: number, color: string, width: number) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        const startX = this.chartOriginX + x;
        const endX = this.chartOriginX + x;
        const startY = this.chartOriginY;
        const endY = this.chartOriginY - (this.chartHeight);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    };

    /**
     * drawHorizontalLine Draw a horizontal line on the chart
     * @param ctx    - Canvas context
     * @param y      - y position of the line (Relative to the chartOriginY) 
     * @param color 
     * @param width 
     */
    private drawChartHorizontalLine = (ctx: any, y: number, color: string, width: number) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        const startX = this.chartOriginX;
        const endX = this.chartOriginX + this.chartWidth;
        const startY = this.chartOriginY - y;
        const endY = this.chartOriginY - y;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
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
