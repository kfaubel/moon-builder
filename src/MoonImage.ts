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
    private sunXOrigin: number;
    private sunYOrigin: number;
    private sunColor: string;
    private sunRadius: number;

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
        this.sunXOrigin = 100;
        this.sunYOrigin = 400
        this.sunColor = "#F0F000";
        this.sunRadius = 20;                     


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
        
        const lunarDayMinutes = 24 * 60 + 50; // Lunar day is 24 hours and 50 minutes

        const sunMoonData: MoonData = new MoonData(this.logger, this.cache);

        const sunMoonJson: MoonJson | null = await  sunMoonData.getMoonData(lat, lon, apiKey, timeZone, dateStr);

        if (sunMoonJson === null) {
            this.logger.error(`MoonImage: getImage() failed to get data for ${location} on ${dateStr}`);
            return null;
        }

        const moonRiseMinutes = this.getMinutes(sunMoonJson.moonrise);
        const moonSetMinutes = this.getMinutes(sunMoonJson.moonset);

        const sunRiseMinutes = this.getMinutes(sunMoonJson.sunrise);
        const sunSetMinutes = this.getMinutes(sunMoonJson.sunset);

        if (sunRiseMinutes === null || sunSetMinutes === null) {
            this.logger.warn(`MoonImage: getImage() No sunrise today! for ${location} on ${dateStr}`);
            return null;
        }
        
        // Calculate the solar noon
        const solarNoonMinutes = (sunRiseMinutes + sunSetMinutes) / 2;
        this.logger.info(`MoonImage: solarNoonMinutes: ${solarNoonMinutes}`);

        // Calculate the offset from solar noon to center the graph (12PM)
        // If solar noon is 12:30, then the offset is 30 minutes
        // if solar noon is 11:30, then the offset is -30 minutes
        // This lets us center the sine wave on solar noon
        const noonOffset = solarNoonMinutes - 720; // Center the graph on solar noon

        // We start the graph at midnight which is bottom of the sine wave
        // This is nominally 6 hours (360 minutes) before sunrise, but we need to adjust for the offset
        const sunStartMinutes = - (360 + noonOffset); 
        this.logger.info(`MoonImage: sunStartMinutes: ${sunStartMinutes}`);

        // Now we need to adjust sine wave so the positive crossing is at sunrise and the negative crossing is at sunset
        // Without this up or down offset, the sine wave will cross the x-axis at 6AM and 6PM
        //         Sunrise |      *
        //            6AM  v   *
        //                   *
        // ------------|---*------------
        //               *         y           <--  y = sin(x) * sineWaveHeight
        //             *          ---
        //           * | x |                   <--  x = sunRise - 6 hours (360 minutes)
        //        *
        // The point we want the graph to cross the x access is (sunRiseMinutes - 360)

        const sunGraphXAdjustment = sunRiseMinutes - 360;
        const sunGraphYAdjustment = Math.sin((sunGraphXAdjustment/4)/(180/Math.PI)) * this.sineWaveHeight + 4;  // +4 to move the sine wave up a bit (hack!)
        

        // if (sunMoonJson.moonrise === "-:-") // No moonrise this day.  Use AM midnight
        //     sunMoonJson.moonrise = "0:0";
        // if (sunMoonJson.moonset === "-:-")  // No moonset this day. Use PM midnight
        //     sunMoonJson.moonset = "23:59";

        

        if (moonRiseMinutes === null) {
            // No moonrise this day.
        }

        this.logger.info(`MoonImage: getImage() for ${location} on ${sunMoonJson.date}`);
        this.logger.info(`MoonImage: SunRise: ${sunMoonJson.sunrise} SunSet: ${sunMoonJson.sunset}`);
        this.logger.info(`MoonImage: MoonRise: ${sunMoonJson.moonrise} MoonSet: ${sunMoonJson.moonset}`);

        const twilightDegrees          = 24;     // 24 degrees before sunrise and 24 degrees after sunset
        const twilightMinutes          = 24 * 4; // 4 minutes per degree (96 minutes)

        const dataDate        = new Date(sunMoonJson.date + "T00:00:00"); // Without the explicit time, Date.Parse assume this is UTC and the day is off by 1.
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
        this.drawLine(ctx, this.sunXOrigin,  this.sunYOrigin, 1540, 400, this.gridColor, 1);

        for (let i = 0; i <= 24; i++) {
            this.drawLine(ctx, this.sunXOrigin + i * this.sineWaveWidth/24,  this.sunYOrigin - 10, 100 + i * this.sineWaveWidth/24,  this.sunYOrigin + 10, this.gridColor, 1);
        }
        
        for (let i = 0; i <= 24; i = i + 12) {
            this.drawLine(ctx, this.sunXOrigin + i * this.sineWaveWidth/24,  this.sunYOrigin - 20, 100 + i * this.sineWaveWidth/24,  this.sunYOrigin + 20, this.gridColor, 1);
        }
        
        this.drawSine(ctx, this.sunXOrigin, this.sunYOrigin + sunGraphYAdjustment, this.sineWaveWidth, this.sineWaveHeight, sunStartMinutes, 2, this.sineColor);

        const currentHour = moment.tz(timeZone).hour();  
        const currentMinute = moment.tz(timeZone).minute();  
        this.logger.verbose(`WeatherImage: Current hour: ${currentHour}, minute: ${currentMinute} in location timezone: ${timeZone}`); 

        //private drawSun = (ctx: any, originX: number, originY: number, width: number, height: number, sunPositionMinutes: number, color: string) => {
     
        this.drawSun(ctx, this.sunXOrigin, this.sunYOrigin+ sunGraphYAdjustment, this.sineWaveWidth, this.sineWaveHeight, currentHour * 60 + currentMinute, this.sunColor);

        // Draw the baseline for the moon data
        this.drawLine(ctx, this.sunXOrigin, 800, 1540, 800, this.gridColor, 2);

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
     * drawVerticalLine Draw a vertical line on the chart
     * @param ctx    - Canvas context
     * @param originX - x position of the line (Relative to the chartOriginX)
     * @param originY - y position of the line (Relative to the chartOriginY)
     * @param width   - width of the sine wave
     * @param height  - height of the sine wave
     * @param startX  - x position of the line (in minutes)
     * @param color   - color of the line     * 
     */
    private drawSine = (ctx: any, originX: number, originY: number, width: number, height: number, startX: number, lineWidth: number, color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth
        
        ctx.beginPath();
        const y0 = originY - Math.sin((startX/4)/(180/Math.PI)) * height;

        ctx.moveTo(originX, y0);

        for (let i = 1; i <= width; i++) {
            const x = originX + i;
            const a = (startX + i);
            const y = originY - Math.sin((a/4)/(180/Math.PI)) * height;
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
    private drawSun = (ctx: any, originX: number, originY: number, width: number, height: number, sunPositionMinutes: number, color: string) => {
        ctx.fillStyle = this.sunColor;
        
        ctx.beginPath();
        
        const x = originX + sunPositionMinutes;
        const y = originY - Math.sin((sunPositionMinutes/4 - 90)/(180/Math.PI)) * height;
            
        ctx.arc(x, y, this.sunRadius, 0, 2 * Math.PI);  // Now draw the sun itself
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
