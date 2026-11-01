export interface PersonalThemeToken{user:string;epoch:number}
export interface PersonalThemeReadToken extends PersonalThemeToken{read:number}
export interface PersonalThemeScope{
 current():PersonalThemeToken;
 allows(token:PersonalThemeToken):boolean;
 matches(user:string):boolean;
 enter(user:string):PersonalThemeToken;
 invalidate():void;
 startRead(token:PersonalThemeToken):PersonalThemeReadToken|null;
 allowsRead(token:PersonalThemeReadToken):boolean;
 beginWrite(token:PersonalThemeToken):boolean;
 endWrite(token:PersonalThemeToken):boolean;
}
export function createPersonalThemeScope(initialUser:string):PersonalThemeScope;
export function themeGridColumns(width:number):1|2|3;
export function themeGridItemWidth(columns:1|2|3):'31%'|'48%'|'100%';
