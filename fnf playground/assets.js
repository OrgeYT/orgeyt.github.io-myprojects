/* assets.js - constants, XML strings, parsing utilities */

export const CHAR_IMG_URL = "purplepostor.png";
export const NOTE_IMG_URL = "NOTE_assets-Voiid-Chronicles.png";
export const HIT_SOUND_URL = "osu-hit-sound.mp3";

export let hitAudio = new Audio(HIT_SOUND_URL);

export const CHAR_XML = `<?xml version="1.0" encoding="utf-8"?>
<TextureAtlas imagePath="purplepostor-dark.png">
	<SubTexture name="down pose0000" x="1026" y="899" width="542" height="371" frameX="0" frameY="-15" frameWidth="542" frameHeight="436"/>
	<SubTexture name="down pose0001" x="1026" y="899" width="542" height="371" frameX="0" frameY="-15" frameWidth="542" frameHeight="436"/>
	<SubTexture name="down pose0002" x="2454" y="903" width="461" height="433" frameX="-40" frameY="-1" frameWidth="542" frameHeight="436"/>
	<SubTexture name="down pose0003" x="2454" y="903" width="461" height="433" frameX="-40" frameY="-1" frameWidth="542" frameHeight="436"/>
	<SubTexture name="down pose0004" x="3399" y="885" width="466" height="436" frameX="-38" frameY="0" frameWidth="542" frameHeight="436"/>
	<SubTexture name="down pose0005" x="3399" y="885" width="466" height="436" frameX="-38" frameY="0" frameWidth="542" frameHeight="436"/>
	<SubTexture name="down pose0006" x="3399" y="885" width="466" height="436" frameX="-38" frameY="0" frameWidth="542" frameHeight="436"/>
	<SubTexture name="down pose0007" x="3399" y="885" width="466" height="436" frameX="-38" frameY="0" frameWidth="542" frameHeight="436"/>
	<SubTexture name="down pose0008" x="3399" y="885" width="466" height="436" frameX="-38" frameY="0" frameWidth="542" frameHeight="436"/>
	<SubTexture name="down pose0009" x="3399" y="885" width="466" height="436" frameX="-38" frameY="0" frameWidth="542" frameHeight="436"/>
	<SubTexture name="idle pose0000" x="1026" y="434" width="475" height="465" frameX="-15" frameY="-2" frameWidth="490" frameHeight="467"/>
	<SubTexture name="idle pose0001" x="1026" y="434" width="475" height="465" frameX="-15" frameY="-2" frameWidth="490" frameHeight="467"/>
	<SubTexture name="idle pose0002" x="1501" y="434" width="471" height="458" frameX="-15" frameY="0" frameWidth="490" frameHeight="467"/>
	<SubTexture name="idle pose0003" x="1501" y="434" width="471" height="458" frameX="-15" frameY="0" frameWidth="490" frameHeight="467"/>
	<SubTexture name="idle pose0004" x="2456" y="452" width="475" height="451" frameX="-8" frameY="0" frameWidth="490" frameHeight="467"/>
	<SubTexture name="idle pose0005" x="2456" y="452" width="475" height="451" frameX="-8" frameY="0" frameWidth="490" frameHeight="467"/>
	<SubTexture name="idle pose0006" x="1972" y="436" width="484" height="444" frameX="-1" frameY="0" frameWidth="490" frameHeight="467"/>
	<SubTexture name="idle pose0007" x="1972" y="436" width="484" height="444" frameX="-1" frameY="0" frameWidth="490" frameHeight="467"/>
	<SubTexture name="idle pose0008" x="3356" y="442" width="485" height="443" frameX="0" frameY="0" frameWidth="490" frameHeight="467"/>
	<SubTexture name="idle pose0009" x="3356" y="442" width="485" height="443" frameX="0" frameY="0" frameWidth="490" frameHeight="467"/>
	<SubTexture name="left pose0000" x="544" y="0" width="607" height="428" frameX="0" frameY="0" frameWidth="625" frameHeight="437"/>
	<SubTexture name="left pose0001" x="544" y="0" width="607" height="428" frameX="0" frameY="0" frameWidth="625" frameHeight="437"/>
	<SubTexture name="left pose0002" x="2268" y="0" width="555" height="436" frameX="-68" frameY="-1" frameWidth="625" frameHeight="437"/>
	<SubTexture name="left pose0003" x="2268" y="0" width="555" height="436" frameX="-68" frameY="-1" frameWidth="625" frameHeight="437"/>
	<SubTexture name="left pose0004" x="1151" y="0" width="559" height="434" frameX="-66" frameY="-1" frameWidth="625" frameHeight="437"/>
	<SubTexture name="left pose0005" x="1710" y="0" width="558" height="434" frameX="-66" frameY="-1" frameWidth="625" frameHeight="437"/>
	<SubTexture name="left pose0006" x="1710" y="0" width="558" height="434" frameX="-66" frameY="-1" frameWidth="625" frameHeight="437"/>
	<SubTexture name="left pose0007" x="1710" y="0" width="558" height="434" frameX="-66" frameY="-1" frameWidth="625" frameHeight="437"/>
	<SubTexture name="left pose0008" x="1710" y="0" width="558" height="434" frameX="-66" frameY="-1" frameWidth="625" frameHeight="437"/>
	<SubTexture name="left pose0009" x="1710" y="0" width="558" height="434" frameX="-66" frameY="-1" frameWidth="625" frameHeight="437"/>
	<SubTexture name="right pose0000" x="2931" y="885" width="468" height="440" frameX="0" frameY="-47" frameWidth="505" frameHeight="487"/>
	<SubTexture name="right pose0001" x="2931" y="885" width="468" height="440" frameX="0" frameY="-47" frameWidth="505" frameHeight="487"/>
	<SubTexture name="right pose0002" x="0" y="494" width="486" height="425" frameX="-19" frameY="-59" frameWidth="505" frameHeight="487"/>
	<SubTexture name="right pose0003" x="0" y="494" width="486" height="425" frameX="-19" frameY="-59" frameWidth="505" frameHeight="487"/>
	<SubTexture name="right pose0004" x="1972" y="880" width="482" height="428" frameX="-18" frameY="-59" frameWidth="505" frameHeight="487"/>
	<SubTexture name="right pose0005" x="1972" y="880" width="482" height="428" frameX="-18" frameY="-59" frameWidth="505" frameHeight="487"/>
	<SubTexture name="right pose0006" x="544" y="428" width="482" height="487" frameX="-18" frameY="0" frameWidth="505" frameHeight="487"/>
	<SubTexture name="right pose0007" x="544" y="428" width="482" height="487" frameX="-18" frameY="0" frameWidth="505" frameHeight="487"/>
	<SubTexture name="right pose0008" x="544" y="428" width="482" height="487" frameX="-18" frameY="0" frameWidth="505" frameHeight="487"/>
	<SubTexture name="right pose0009" x="544" y="428" width="482" height="487" frameX="-18" frameY="0" frameWidth="505" frameHeight="487"/>
	<SubTexture name="up pose0000" x="2823" y="0" width="533" height="452" frameX="0" frameY="-58" frameWidth="549" frameHeight="510"/>
	<SubTexture name="up pose0001" x="2823" y="0" width="533" height="452" frameX="0" frameY="-58" frameWidth="549" frameHeight="510"/>
	<SubTexture name="up pose0002" x="3356" y="0" width="545" height="442" frameX="-4" frameY="-55" frameWidth="549" frameHeight="510"/>
	<SubTexture name="up pose0003" x="3356" y="0" width="545" height="442" frameX="-4" frameY="-55" frameWidth="549" frameHeight="510"/>
	<SubTexture name="up pose0004" x="0" y="0" width="544" height="494" frameX="-4" frameY="0" frameWidth="549" frameHeight="510"/>
	<SubTexture name="up pose0005" x="0" y="0" width="544" height="494" frameX="-4" frameY="0" frameWidth="549" frameHeight="510"/>
	<SubTexture name="up pose0006" x="0" y="0" width="544" height="494" frameX="-4" frameY="0" frameWidth="549" frameHeight="510"/>
	<SubTexture name="up pose0007" x="0" y="0" width="544" height="494" frameX="-4" frameY="0" frameWidth="549" frameHeight="510"/>
	<SubTexture name="up pose0008" x="0" y="0" width="544" height="494" frameX="-4" frameY="0" frameWidth="549" frameHeight="510"/>
	<SubTexture name="up pose0009" x="0" y="0" width="544" height="494" frameX="-4" frameY="0" frameWidth="549" frameHeight="510"/>
</TextureAtlas>`;

export const NOTE_XML = `<?xml version="1.0" encoding="utf-8"?>
<TextureAtlas imagePath="NOTE_Default.png">
	<SubTexture name="arrowLEFT0000" x="2577" y="1177" width="153" height="157"/>
	<SubTexture name="arrowDOWN0000" x="2420" y="1177" width="157" height="153"/>
	<SubTexture name="arrowUP0000" x="3820" y="1177" width="157" height="153"/>
	<SubTexture name="arrowRIGHT0000" x="3034" y="1177" width="153" height="157"/>
	<SubTexture name="purple0000" x="1914" y="0" width="154" height="157"/>
	<SubTexture name="left confirm0000" x="3816" y="460" width="217" height="220"/>
	<SubTexture name="left confirm0001" x="0" y="695" width="217" height="220"/>
	<SubTexture name="left confirm0002" x="217" y="695" width="217" height="220"/>
	<SubTexture name="left confirm0003" x="217" y="695" width="217" height="220"/>
	<SubTexture name="left press0000" x="153" y="1177" width="146" height="149"/>
	<SubTexture name="left press0001" x="153" y="1177" width="146" height="149"/>
	<SubTexture name="left press0002" x="299" y="1177" width="146" height="149"/>
	<SubTexture name="left press0003" x="299" y="1177" width="146" height="149"/>
	<SubTexture name="blue0000" x="1600" y="0" width="157" height="154"/>	
	<SubTexture name="down confirm0000" x="2388" y="460" width="238" height="235"/>
	<SubTexture name="down confirm0001" x="2626" y="460" width="238" height="235"/>
	<SubTexture name="down confirm0002" x="2864" y="460" width="238" height="235"/>
	<SubTexture name="down confirm0003" x="2864" y="460" width="238" height="235"/>
	<SubTexture name="down press0000" x="3634" y="944" width="149" height="146"/>
	<SubTexture name="down press0001" x="3634" y="944" width="149" height="146"/>
	<SubTexture name="down press0002" x="3783" y="944" width="149" height="146"/>
	<SubTexture name="down press0003" x="3783" y="944" width="149" height="146"/>
	<SubTexture name="green0000" x="2699" y="0" width="157" height="154"/>
	<SubTexture name="up confirm0000" x="3260" y="695" width="236" height="233"/>
	<SubTexture name="up confirm0001" x="3496" y="695" width="236" height="233"/>
	<SubTexture name="up confirm0002" x="3732" y="695" width="236" height="233"/>
	<SubTexture name="up confirm0003" x="3732" y="695" width="236" height="233"/>
	<SubTexture name="up press0000" x="1816" y="1177" width="153" height="150"/>
	<SubTexture name="up press0001" x="1816" y="1177" width="153" height="150"/>
	<SubTexture name="up press0002" x="1969" y="1177" width="153" height="150"/>
	<SubTexture name="up press0003" x="1969" y="1177" width="153" height="150"/>
	<SubTexture name="red0000" x="2222" y="0" width="154" height="157"/>
	<SubTexture name="right press0000" x="741" y="1177" width="148" height="151"/>
	<SubTexture name="right press0001" x="741" y="1177" width="148" height="151"/>
	<SubTexture name="right press0002" x="889" y="1177" width="148" height="151"/>
	<SubTexture name="right press0003" x="889" y="1177" width="148" height="151"/>
	<SubTexture name="right confirm0000" x="1130" y="695" width="226" height="230"/>
	<SubTexture name="right confirm0001" x="1356" y="695" width="226" height="230"/>
	<SubTexture name="right confirm0002" x="1582" y="695" width="226" height="230"/>
	<SubTexture name="right confirm0003" x="1582" y="695" width="226" height="230"/>
</TextureAtlas>`;

export function parseXML(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    const subTextures = xmlDoc.getElementsByTagName("SubTexture");
    const atlas = {};
    for (let i = 0; i < subTextures.length; i++) {
        const el = subTextures[i];
        const name = el.getAttribute("name");
        const animName = name.replace(/\d{4}$/, '');
        if (!atlas[animName]) atlas[animName] = [];
        atlas[animName].push({
            x: parseInt(el.getAttribute("x")),
            y: parseInt(el.getAttribute("y")),
            w: parseInt(el.getAttribute("width")),
            h: parseInt(el.getAttribute("height")),
            frameX: parseInt(el.getAttribute("frameX")) || 0,
            frameY: parseInt(el.getAttribute("frameY")) || 0,
            frameW: parseInt(el.getAttribute("frameWidth")) || parseInt(el.getAttribute("width")),
            frameH: parseInt(el.getAttribute("frameHeight")) || parseInt(el.getAttribute("height"))
        });
    }
    return atlas;
}
