/**
 * Comprehensive ISO 3166-1 dialing-code list.
 *
 * `value` is unique per entry so select components can distinguish shared
 * dialing prefixes (e.g. +1 USA vs +1 Canada resolve to different values).
 */

export interface DialingCode {
  code: string;
  country: string;
  flag: string;
  value: string; // unique select value
}

function d(code: string, country: string, flag: string, suffix?: string): DialingCode {
  return { code, country, flag, value: suffix ? `${code}-${suffix}` : code };
}

export const DIALING_CODES: DialingCode[] = [
  d("+93", "Afghanistan", "🇦🇫"), d("+355", "Albania", "🇦🇱"), d("+213", "Algeria", "🇩🇿"),
  d("+1", "USA", "🇺🇸"), d("+1", "Canada", "🇨🇦", "CA"), d("+376", "Andorra", "🇦🇩"),
  d("+244", "Angola", "🇦🇴"), d("+672", "Antarctica", "🇦🇶"), d("+54", "Argentina", "🇦🇷"),
  d("+374", "Armenia", "🇦🇲"), d("+297", "Aruba", "🇦🇼"), d("+61", "Australia", "🇦🇺"),
  d("+43", "Austria", "🇦🇹"), d("+994", "Azerbaijan", "🇦🇿"), d("+973", "Bahrain", "🇧🇭"),
  d("+880", "Bangladesh", "🇧🇩"), d("+1", "Barbados", "🇧🇧", "BB"), d("+375", "Belarus", "🇧🇾"),
  d("+32", "Belgium", "🇧🇪"), d("+501", "Belize", "🇧🇿"), d("+229", "Benin", "🇧🇯"),
  d("+975", "Bhutan", "🇧🇹"), d("+591", "Bolivia", "🇧🇴"), d("+387", "Bosnia & Herzegovina", "🇧🇦"),
  d("+267", "Botswana", "🇧🇼"), d("+55", "Brazil", "🇧🇷"), d("+673", "Brunei", "🇧🇳"),
  d("+359", "Bulgaria", "🇧🇬"), d("+226", "Burkina Faso", "🇧🇫"), d("+257", "Burundi", "🇧🇮"),
  d("+855", "Cambodia", "🇰🇭"), d("+237", "Cameroon", "🇨🇲"), d("+238", "Cape Verde", "🇨🇻"),
  d("+236", "Central African Rep.", "🇨🇫"), d("+235", "Chad", "🇹🇩"), d("+56", "Chile", "🇨🇱"),
  d("+86", "China", "🇨🇳"), d("+57", "Colombia", "🇨🇴"), d("+269", "Comoros", "🇰🇲"),
  d("+242", "Congo", "🇨🇬"), d("+243", "DR Congo", "🇨🇩"), d("+682", "Cook Islands", "🇨🇰"),
  d("+506", "Costa Rica", "🇨🇷"), d("+225", "Côte d'Ivoire", "🇨🇮"), d("+385", "Croatia", "🇭🇷"),
  d("+53", "Cuba", "🇨🇺"), d("+357", "Cyprus", "🇨🇾"), d("+420", "Czechia", "🇨🇿"),
  d("+45", "Denmark", "🇩🇰"), d("+253", "Djibouti", "🇩🇯"), d("+1", "Dominica", "🇩🇲", "DM"),
  d("+1", "Dominican Rep.", "🇩🇴", "DO"), d("+593", "Ecuador", "🇪🇨"), d("+20", "Egypt", "🇪🇬"),
  d("+503", "El Salvador", "🇸🇻"), d("+240", "Equatorial Guinea", "🇬🇶"), d("+291", "Eritrea", "🇪🇷"),
  d("+372", "Estonia", "🇪🇪"), d("+268", "Eswatini", "🇸🇿"), d("+251", "Ethiopia", "🇪🇹"),
  d("+679", "Fiji", "🇫🇯"), d("+358", "Finland", "🇫🇮"), d("+33", "France", "🇫🇷"),
  d("+241", "Gabon", "🇬🇦"), d("+220", "Gambia", "🇬🇲"), d("+995", "Georgia", "🇬🇪"),
  d("+49", "Germany", "🇩🇪"), d("+233", "Ghana", "🇬🇭"), d("+30", "Greece", "🇬🇷"),
  d("+299", "Greenland", "🇬🇱"), d("+1", "Grenada", "🇬🇩", "GD"), d("+502", "Guatemala", "🇬🇹"),
  d("+224", "Guinea", "🇬🇳"), d("+245", "Guinea-Bissau", "🇬🇼"), d("+592", "Guyana", "🇬🇾"),
  d("+509", "Haiti", "🇭🇹"), d("+504", "Honduras", "🇭🇳"), d("+852", "Hong Kong", "🇭🇰"),
  d("+36", "Hungary", "🇭🇺"), d("+354", "Iceland", "🇮🇸"), d("+91", "India", "🇮🇳"),
  d("+62", "Indonesia", "🇮🇩"), d("+98", "Iran", "🇮🇷"), d("+964", "Iraq", "🇮🇶"),
  d("+353", "Ireland", "🇮🇪"), d("+972", "Israel", "🇮🇱"), d("+39", "Italy", "🇮🇹"),
  d("+1", "Jamaica", "🇯🇲", "JM"), d("+81", "Japan", "🇯🇵"), d("+962", "Jordan", "🇯🇴"),
  d("+7", "Kazakhstan", "🇰🇿", "KZ"), d("+254", "Kenya", "🇰🇪"), d("+686", "Kiribati", "🇰🇮"),
  d("+383", "Kosovo", "🇽🇰"), d("+965", "Kuwait", "🇰🇼"), d("+996", "Kyrgyzstan", "🇰🇬"),
  d("+856", "Laos", "🇱🇦"), d("+371", "Latvia", "🇱🇻"), d("+961", "Lebanon", "🇱🇧"),
  d("+266", "Lesotho", "🇱🇸"), d("+231", "Liberia", "🇱🇷"), d("+218", "Libya", "🇱🇾"),
  d("+423", "Liechtenstein", "🇱🇮"), d("+370", "Lithuania", "🇱🇹"), d("+352", "Luxembourg", "🇱🇺"),
  d("+853", "Macau", "🇲🇴"), d("+261", "Madagascar", "🇲🇬"), d("+265", "Malawi", "🇲🇼"),
  d("+60", "Malaysia", "🇲🇾"), d("+960", "Maldives", "🇲🇻"), d("+223", "Mali", "🇲🇱"),
  d("+356", "Malta", "🇲🇹"), d("+692", "Marshall Islands", "🇲🇭"), d("+222", "Mauritania", "🇲🇷"),
  d("+230", "Mauritius", "🇲🇺"), d("+52", "Mexico", "🇲🇽"), d("+691", "Micronesia", "🇫🇲"),
  d("+373", "Moldova", "🇲🇩"), d("+377", "Monaco", "🇲🇨"), d("+976", "Mongolia", "🇲🇳"),
  d("+382", "Montenegro", "🇲🇪"), d("+212", "Morocco", "🇲🇦"), d("+258", "Mozambique", "🇲🇿"),
  d("+95", "Myanmar", "🇲🇲"), d("+264", "Namibia", "🇳🇦"), d("+674", "Nauru", "🇳🇷"),
  d("+977", "Nepal", "🇳🇵"), d("+31", "Netherlands", "🇳🇱"), d("+64", "New Zealand", "🇳🇿"),
  d("+505", "Nicaragua", "🇳🇮"), d("+227", "Niger", "🇳🇪"), d("+234", "Nigeria", "🇳🇬"),
  d("+850", "North Korea", "🇰🇵"), d("+389", "North Macedonia", "🇲🇰"), d("+47", "Norway", "🇳🇴"),
  d("+968", "Oman", "🇴🇲"), d("+92", "Pakistan", "🇵🇰"), d("+680", "Palau", "🇵🇼"),
  d("+970", "Palestine", "🇵🇸"), d("+507", "Panama", "🇵🇦"), d("+675", "Papua New Guinea", "🇵🇬"),
  d("+595", "Paraguay", "🇵🇾"), d("+51", "Peru", "🇵🇪"), d("+63", "Philippines", "🇵🇭"),
  d("+48", "Poland", "🇵🇱"), d("+351", "Portugal", "🇵🇹"), d("+974", "Qatar", "🇶🇦"),
  d("+40", "Romania", "🇷🇴"), d("+7", "Russia", "🇷🇺"), d("+250", "Rwanda", "🇷🇼"),
  d("+590", "St. Kitts & Nevis", "🇰🇳", "KN"), d("+1", "St. Lucia", "🇱🇨", "LC"),
  d("+1", "St. Vincent", "🇻🇨", "VC"), d("+685", "Samoa", "🇼🇸"), d("+378", "San Marino", "🇸🇲"),
  d("+239", "São Tomé & Príncipe", "🇸🇹"), d("+966", "Saudi Arabia", "🇸🇦"), d("+221", "Senegal", "🇸🇳"),
  d("+381", "Serbia", "🇷🇸"), d("+248", "Seychelles", "🇸🇨"), d("+232", "Sierra Leone", "🇸🇱"),
  d("+65", "Singapore", "🇸🇬"), d("+421", "Slovakia", "🇸🇰"), d("+386", "Slovenia", "🇸🇮"),
  d("+677", "Solomon Islands", "🇸🇧"), d("+252", "Somalia", "🇸🇴"), d("+27", "South Africa", "🇿🇦"),
  d("+82", "South Korea", "🇰🇷"), d("+211", "South Sudan", "🇸🇸"), d("+34", "Spain", "🇪🇸"),
  d("+94", "Sri Lanka", "🇱🇰"), d("+249", "Sudan", "🇸🇩"), d("+597", "Suriname", "🇸🇷"),
  d("+46", "Sweden", "🇸🇪"), d("+41", "Switzerland", "🇨🇭"), d("+963", "Syria", "🇸🇾"),
  d("+886", "Taiwan", "🇹🇼"), d("+992", "Tajikistan", "🇹🇯"), d("+255", "Tanzania", "🇹🇿"),
  d("+66", "Thailand", "🇹🇭"), d("+228", "Togo", "🇹🇬"), d("+676", "Tonga", "🇹🇴"),
  d("+1", "Trinidad & Tobago", "🇹🇹", "TT"), d("+216", "Tunisia", "🇹🇳"), d("+90", "Türkiye", "🇹🇷"),
  d("+993", "Turkmenistan", "🇹🇲"), d("+688", "Tuvalu", "🇹🇻"), d("+256", "Uganda", "🇺🇬"),
  d("+380", "Ukraine", "🇺🇦"), d("+971", "UAE", "🇦🇪"), d("+44", "United Kingdom", "🇬🇧"),
  d("+1", "US Virgin Islands", "🇻🇮", "VI"), d("+598", "Uruguay", "🇺🇾"), d("+998", "Uzbekistan", "🇺🇿"),
  d("+678", "Vanuatu", "🇻🇺"), d("+39", "Vatican City", "🇻🇦", "VA"), d("+58", "Venezuela", "🇻🇪"),
  d("+84", "Vietnam", "🇻🇳"), d("+967", "Yemen", "🇾🇪"), d("+260", "Zambia", "🇿🇲"),
  d("+263", "Zimbabwe", "🇿🇼"),
];

/** Common select entries (bare codes) kept first for quick discovery. */
export function orderByCommon(code: string): number {
  const common = ["+44", "+234", "+1", "+91", "+49", "+33", "+27", "+254", "+233", "+971", "+61", "+86"];
  const idx = common.indexOf(code);
  return idx === -1 ? common.length : idx;
}
