// Home timezone(s) per competing nation, used to show a game's tip-off time in
// each team's own country ("Tip-off in Japan: Aug 28, 10:00 PM JST").
//
// A country with several zones lists them all, widest-used first; the formatter
// collapses zones that read the same wall clock at that instant, so a country
// only shows multiple lines when its clocks genuinely differ.
//
// Only the zones a national team's own audience would use are listed. This is the
// real 32-nation field of the 2023 tournament.
export const TEAM_TIMEZONES = {
  Angola: ['Africa/Luanda'],
  Australia: ['Australia/Sydney', 'Australia/Brisbane', 'Australia/Adelaide', 'Australia/Perth'],
  Brazil: ['America/Sao_Paulo', 'America/Manaus'],
  Canada: ['America/Toronto', 'America/Winnipeg', 'America/Edmonton', 'America/Vancouver', 'America/Halifax'],
  'Cape Verde': ['Atlantic/Cape_Verde'],
  China: ['Asia/Shanghai'],
  "Côte d'Ivoire": ['Africa/Abidjan'],
  'Dominican Republic': ['America/Santo_Domingo'],
  Egypt: ['Africa/Cairo'],
  Finland: ['Europe/Helsinki'],
  France: ['Europe/Paris'],
  Georgia: ['Asia/Tbilisi'],
  Germany: ['Europe/Berlin'],
  Greece: ['Europe/Athens'],
  Iran: ['Asia/Tehran'],
  Italy: ['Europe/Rome'],
  Japan: ['Asia/Tokyo'],
  Jordan: ['Asia/Amman'],
  Latvia: ['Europe/Riga'],
  Lebanon: ['Asia/Beirut'],
  Lithuania: ['Europe/Vilnius'],
  Mexico: ['America/Mexico_City', 'America/Tijuana', 'America/Hermosillo', 'America/Cancun'],
  Montenegro: ['Europe/Podgorica'],
  'New Zealand': ['Pacific/Auckland'],
  Philippines: ['Asia/Manila'],
  'Puerto Rico': ['America/Puerto_Rico'],
  Serbia: ['Europe/Belgrade'],
  Slovenia: ['Europe/Ljubljana'],
  'South Sudan': ['Africa/Juba'],
  Spain: ['Europe/Madrid', 'Atlantic/Canary'],
  'United States': ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'],
  Venezuela: ['America/Caracas'],
}
