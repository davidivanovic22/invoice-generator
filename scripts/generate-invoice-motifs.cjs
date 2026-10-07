// Original seasonal vector artwork; no existing project assets are read.
// Regenerate with: node scripts/generate-invoice-motifs.cjs
const fs=require('fs'), path=require('path');
const root=path.resolve(__dirname,'..'), output=path.join(root,'public/invoice-motifs'), review=path.join(root,'design-review');
fs.mkdirSync(output,{recursive:true}); fs.mkdirSync(review,{recursive:true});
const P=(d,f='none',o=1,w=1.3)=>`<path d="${d}" fill="${f}" opacity="${o}" stroke-width="${w}"/>`;
const C=(x,y,r,f='none',o=1)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" opacity="${o}"/>`;
const E=(x,y,rx,ry,f='none',o=1)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}" opacity="${o}"/>`;
const R=(x,y,w,h,f='none',r=2)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${f}"/>`;
const G=(b,t,o=1)=>`<g transform="${t}" opacity="${o}">${b}</g>`;
const A='@accent', B='@light', D='@deep', L='@leaf', O='@gold', W='@paper';
const leaf=P('M0 0C-21-9-24-31-10-43 7-32 16-12 0 0Z',L,.7)+P('M0 0L-10-37M-5-17l-11-9M-7-26l7-9','none',.65,.9);
function sprig(){let s=P('M80 151Q57 93 96 12','none',.85,1.2);for(let i=0;i<6;i++)s+=G(leaf,`translate(${76+i*2} ${139-i*19}) rotate(${i%2?62:-72}) scale(.7)`);return s;}
const petal=P('M80 77C52 60 49 21 73 19 97 17 102 52 80 77Z',B)+P('M80 72Q67 42 73 25','none',.35,.8);
function flower(n=8){return Array.from({length:n},(_,i)=>G(petal,`rotate(${i*360/n} 80 80)`)).join('')+C(80,80,13,O)+C(80,80,7,W)+Array.from({length:10},(_,i)=>C(80+Math.cos(i*.628)*10,80+Math.sin(i*.628)*10,1,D)).join('');}
function pineBranch(){let s=P('M20 143L136 22','none',1,2);for(let i=0;i<12;i++){const x=29+i*8,y=134-i*8;s+=P(`M${x} ${y}l-27-4M${x} ${y}l-15-20M${x} ${y}l4-27M${x} ${y}l20-15`,'none',.85,1.2);}return s;}
const heart=P('M80 138C55 117 19 95 19 61 19 21 62 20 80 51c18-31 61-30 61 10 0 34-36 56-61 77Z',B)+P('M33 59q0-19 19-22M41 99q18 20 34 28','none',.5,1);
const bow=P('M72 72C18 25 10 61 22 85q9 22 50 1ZM88 72c54-47 62-11 50 13-9 22-50 1-50 1Z',B)+P('M69 85l-28 57 23-6 10 9 13-55M89 87l25 55 7-16 22 5-40-48',A,.75)+R(68,68,24,25,O,5)+P('M27 68l38 10M134 68l-37 10M74 100l-17 28M102 99l21 24','none',.5,1);
const grass=P('M80 145Q63 76 35 49M80 145Q83 60 116 21M80 145Q36 108 17 99M80 145q36-60 64-75M80 145Q56 38 69 14','none',.9,1.2)+G(leaf,'translate(62 115) rotate(-38) scale(.65)')+G(leaf,'translate(91 95) rotate(61) scale(.65)');
const motifs={
sprig:sprig(),pinebranch:'<g stroke="@leaf">'+pineBranch()+'</g>',heart,bow,grass,
berry:sprig()+[[91,28],[63,51],[93,69],[57,90],[85,109]].map(([x,y])=>C(x,y,7,A)+P(`M${x-2} ${y-3}l3-2`,W,.7,1)).join(''),
snowflake:Array.from({length:6},(_,i)=>G(P('M80 80V17M80 32l-10-9M80 32l10-9M80 49L62 35M80 49l18-14M80 66L58 54M80 66l22-12','none',1,1.4),`rotate(${i*60} 80 80)`)).join('')+C(80,80,7,B),
crystal:P('M80 14L114 45 128 80 106 129 80 146 54 129 32 80 46 45Z',B,.9)+P('M80 14v132M32 80h96M46 45l60 84M114 45l-60 84M46 45h68L106 129H54Z','none',.8,1)+P('M80 33l30 47-30 47-30-47z',W,.7),
mountain:P('M9 133L60 37 87 82 113 24 154 133Z',B)+P('M34 86l26-49 27 45-20-9-9 15-9-8z',W)+P('M92 69l21-45 22 58-19-10-11 7z',W)+P('M60 90l-20 43M112 87l23 46M67 114l10 19','none',.55,1),
pine:P('M80 13L48 54h17L35 90h22L24 128h112L103 90h22L95 54h17Z',L,.85)+P('M73 128v19h14v-19',O)+P('M80 25L57 54h18M81 61L46 93h28M80 99l-42 28h38',W,.85)+P('M80 31v92','none',.35,1),
chalet:R(35,76,95,62,O,1)+P('M20 78L81 29 145 78Z',D)+P('M20 78L81 29 145 78 142 87 81 41 24 86Z',W)+R(108,30,13,29,O,0)+R(47,93,22,22,W,1)+R(94,91,20,22,W,1)+R(75,106,17,32,D,1)+P('M58 93v22M47 104h22M104 91v22M94 102h20M38 123h35M94 125h32M38 133h35M31 142h110M112 18q-10-8 0-14','none',.8,1),
skis:P('M58 16q-12-8-12 13v110q0 9 12 8V29q0-12 0-13Z',A)+P('M95 15q-12-9-12 13v111q0 9 12 8V28q0-12 0-13Z',B)+R(43,82,18,20,D)+R(80,82,18,20,D)+P('M50 31v44M87 30v45M117 29L103 143M129 34l-13 110M98 131h14M109 132h14','none',1,1.3)+C(118,25,5,O)+C(130,31,5,O),
sled:P('M29 75h94v14H29Z',O)+P('M42 89v27M111 89v27M22 116h111q23 0 14-17M35 129h98q23 0 14-17M23 75q-14-14-4-24 7-6 13 2M123 75l14-27','none',1,2.2)+P('M48 75v14M67 75v14M86 75v14M105 75v14M43 89l60 27M112 89l-60 27M31 53Q73 11 126 43','none',.65,1),
ice:E(80,105,70,29,B)+P('M14 102q38-10 67-4t63 1M32 117q28-9 53-3t40-3M46 94l22 12-8 11M104 90l-14 13 19 14','none',.65,1)+P('M27 73q8-25 18-17l6 26M118 71l10-20 12 31',W)+P('M15 83q58-10 131 0','none',.55,1),
mitten:P('M44 119V55q0-34 19-30 8-2 12 8 14-13 24-1 17-7 20 12v36q12-26 25-13 7 9-15 37l-15 18Z',B)+R(42,119,74,25,A,3)+P('M50 125v14M62 125v14M74 125v14M86 125v14M98 125v14M109 125v14M60 49v37M79 43v38M99 47v34M51 104q23-12 53 0','none',.65,1)+G(P('M80 90v22M69 95l22 12M69 107l22-12','none',.8,1.2),'translate(-4 -8)'),
scarf:P('M33 38q35-19 80-2l-3 28q-39-16-75 0z',A)+P('M72 60h26l11 71-29 5z',B)+P('M40 60h26l-3 79-30-3z',A)+P('M41 41l3 17M57 37l2 18M76 37v18M94 39l-2 18M104 99l-28 4M107 117l-29 4M35 94l29 3M34 116l30 2M35 136v12M45 137v12M56 138v12M83 135l2 12M94 133l2 12M105 132l2 12','none',.8,1.3),
moon:P('M110 26a57 57 0 10 24 90 53 53 0 01-24-90Z',O)+P('M37 109q24 32 62 18','none',.55,1)+C(117,57,4,B)+C(138,86,2,A),
star:P('M80 13l17 43 47 3-37 29 12 46-39-26-39 26 12-46-37-29 47-3Z',O)+P('M80 13v95M16 59l64 49 64-49M41 134l39-26 39 26','none',.3,1),
rose:P('M80 90v63M80 126q-29-1-34-26 28 0 34 26M80 139q32-1 39-29-29 1-39 29',L)+P('M80 92C42 92 26 65 41 46 34 24 59 11 80 25 103 10 128 29 119 49 135 70 115 93 80 92Z',B)+P('M79 81C48 79 45 53 57 43q23-25 47 0c17 14 7 42-25 38ZM80 70q-22-7-10-20 11-12 24-1 6 12-14 21ZM44 49q9 19 32 24M111 44q-18-3-29 5M80 27q4 12-13 19','none',.9,1.3),
birds:P('M14 96q12-43 43-29l22 10-10 8q-3 38-37 36z',B)+P('M146 96q-12-43-43-29l-22 10 10 8q3 38 37 36z',A,.65)+P('M31 95q19-10 25 12-18 9-25-12ZM129 95q-19-10-25 12 18 9 25-12Z',W)+C(61,76,2,D)+C(99,76,2,D)+P('M32 121l-8 15M44 120l-3 17M128 121l8 15M116 120l3 17M18 138q59-18 125 0','none',.85,1.3)+G(heart,'translate(62 5) scale(.22)'),
cupid:P('M67 61Q24 27 16 47q-10 22 42 40M92 63q43-41 52-15 4 20-39 37',W)+P('M23 49l32 23M25 60l29 19M133 49l-30 23M131 62l-27 17','none',.65,1)+C(80,42,19,B)+P('M61 38q-1-23 25-19 16 3 16 20-17-11-24-8-3 10-17 7Z',O)+P('M69 61q-20 39 1 52h23q17-18-1-52Z',B)+P('M69 77L44 91M94 77l27 21M71 111l-12 26M92 112l17 23M121 63q30 35-1 72l1-72M40 100l103-2M135 91l8 7-8 7','none',1,1.5)+C(74,43,1,D)+C(86,43,1,D)+P('M76 52q4 4 8 0','none',1,1),
terrace:P('M22 86h116M28 86v48M132 86v48M32 94h96M40 94v34M55 94v34M70 94v34M85 94v34M100 94v34M115 94v34M23 135h115','none',.9,1.5)+E(81,74,30,8,B)+P('M81 82v48M68 130h26M36 99V73H20v37M124 100V73h16v37','none',.85,1.6)+C(74,66,5,A)+C(84,64,5,A)+P('M74 71v8M84 69v10','none',.6,1),
envelope:P('M19 42h122v82H19Z',W)+P('M19 42l61 48 61-48M19 124l47-43M141 124L95 81','none',.8,1.3)+G(heart,'translate(57 61) scale(.29)'),
umbrella:P('M17 80a63 63 0 01126 0q-16-14-31 0-16-14-32 0-16-14-32 0-15-14-31 0Z',B)+P('M80 18q-27 29-32 62M80 18q27 29 32 62M80 18v-7M80 80v53q0 23 21 9','none',1,1.8)+P('M17 80q4-27 22-43M121 37q18 16 22 43','none',.5,1),
rain:Array.from({length:7},(_,i)=>G(P('M80 20C66 45 54 62 54 79a26 26 0 0052 0c0-17-12-34-26-59Z',B)+P('M66 76q-5 14 6 19','none',.5,1),`translate(${(i%3)*49-6} ${Math.floor(i/3)*47+5}) scale(.28)`)).join(''),
puddle:E(80,102,66,21,B)+E(83,103,47,12,'none',.5)+P('M19 101h26M108 109h23M68 90h40M43 55l-6 12M100 35l-7 14M123 66l-5 12','none',.7,1.2)+C(55,101,6,W,.7),
lantern:P('M47 61h66l-7 63H54Z',B)+P('M40 59h80L100 41H60ZM49 129h62l8 9H41Z',D)+P('M64 40V26q16-18 32 0v14M63 62l4 60M97 62l-4 60M80 64v60','none',1,1.6)+P('M77 113q-21-9-4-34-2 12 7 12 15-15 10 9-2 11-13 13Z',O)+R(73,112,14,11,W,1),
snowdrop:P('M59 145V57q0-40 25-36 18 1 18 27M86 145V85q0-33 22-31M59 127q-29-20-32-59 28 11 32 59M86 137q31-27 35-56-30 15-35 56',L)+P('M101 45q-25 22-12 43l12-13 12 13q13-21-12-43ZM108 54q-20 19-10 35l10-10 10 10q10-16-10-35Z',W)+P('M101 53v20M108 61v16','none',.55,1),
crocus:P('M77 146V75M82 145q21-47 40-67-8 45-40 67M70 143q-29-29-31-66 24 24 31 66',L)+P('M80 90Q31 67 41 36q29 8 39 42 10-34 39-42 10 31-39 54Z',A,.65)+P('M80 88Q52 50 80 20q28 30 0 68Z',B)+P('M80 78V42','none',.8,1.3)+C(80,60,3,O),
cobbles:[[18,91,29,16],[51,86,30,16],[85,90,30,16],[119,85,26,17],[29,111,29,15],[62,109,30,17],[96,111,32,15],[12,132,26,13],[42,130,30,14],[77,131,27,14],[108,130,36,15]].map(([x,y,w,h])=>R(x,y,w,h,B,5)).join('')+P('M27 97h12M67 92h9M96 116h16M56 137h9','none',.35,.8),
boots:P('M34 30h35l-3 71q31 2 29 22H27l1-16Z',A,.7)+P('M85 25h35l-3 72q31 2 29 22H78l1-16Z',B)+P('M34 40h34M85 35h34M27 123v8h68v-8M78 119v8h68v-8M44 48l-4 52M95 45l-3 52','none',.7,1.4),
blossom:flower(5),
blossombranch:P('M17 142Q54 81 137 22M51 96L33 58M88 62l-1-35M112 42l29 19','none',1,2)+G(flower(5),'translate(9 26) scale(.38)')+G(flower(5),'translate(54 -3) scale(.4)')+G(flower(5),'translate(103 31) scale(.32)')+G(leaf,'translate(70 74) rotate(63) scale(.75)')+G(leaf,'translate(116 35) rotate(-40) scale(.6)'),
butterfly:P('M80 80C53 17 7 19 20 67q3 19 33 20-38 10-26 36 18 27 53-25 35 52 53 25 12-26-26-36 30-1 33-20 13-48-60 13Z',B)+P('M77 67q-6 27 3 44 9-17 3-44z',D)+P('M77 67L66 49M83 67l11-18M29 48q22-13 43 33M131 48q-22-13-43 33M38 109l28-14M122 109l-28-14','none',.6,1)+C(43,60,5,A)+C(117,60,5,A)+C(42,111,4,O)+C(118,111,4,O),
petal:P('M33 107Q20 43 93 27q41 64-16 99-32 11-44-19Z',B)+P('M38 108Q50 61 91 32','none',.45,1.2),
tree:P('M77 145V71M84 145V82M79 112L47 86M81 96l30-31',O)+P('M30 82Q7 44 42 34q0-31 34-19 31-15 40 14 40 6 24 42 9 35-30 33-38 27-59-1-26 8-21-21Z',L,.55)+G(flower(5),'translate(22 25) scale(.3)')+G(flower(5),'translate(61 7) scale(.32)')+G(flower(5),'translate(90 52) scale(.24)'),
gate:P('M20 141V68q60-74 120 0v73M30 140V71q50-59 100 0v69M32 96h96M38 96v45M54 96v45M70 96v45M90 96v45M106 96v45M122 96v45M80 81v60','none',1,2)+G(sprig(),'translate(-12 44) scale(.62)')+G(sprig(),'translate(110 26) rotate(24) scale(.6)'),
tulip:P('M80 88v63M80 135q-40-10-42-47 38 8 42 47M80 144q35-8 42-48-33 13-42 48',L)+P('M43 29l24 17 13-23 13 23 24-17v31q-3 35-37 35T43 60Z',B)+P('M67 46q-10 37 13 49 23-12 13-49','none',.55,1.3),
peony: [ [10,1,0],[8,.73,20],[6,.48,0] ].map(([n,scale,offset])=>Array.from({length:n},(_,i)=>G(P('M80 95C52 90 36 66 49 49q8-12 20-3 5-16 19-15 17 1 14 21 18-5 21 10 1 19-43 33Z',i%3===0?A:B,.85)+P('M79 91q-17-15-17-33M83 87q14-15 10-34','none',.35,.8),`translate(80 80) rotate(${i*360/n+offset}) scale(${scale}) translate(-80 -80)`)).join('')).join('')+C(80,80,8,O)+G(leaf,'translate(43 139) rotate(-35) scale(.7)')+G(leaf,'translate(114 138) rotate(35) scale(.7)'),
daisy:Array.from({length:14},(_,i)=>G(E(80,48,8,29,'#ffffff')+P('M80 63V28','none',.25,.7),`rotate(${i*360/14} 80 80)`)).join('')+C(80,80,15,O)+C(80,80,9,O)+Array.from({length:12},(_,i)=>C(80+Math.cos(i*Math.PI/6)*10,80+Math.sin(i*Math.PI/6)*10,1.1,D,.55)).join(''),
wildflower:P('M80 149V71M80 113l-24-30M80 126l28-35M80 140l-34-22','none',1,1.4)+G(flower(6),'translate(52 13) scale(.38)')+G(flower(5),'translate(18 47) scale(.36)')+G(flower(5),'translate(82 54) scale(.32)')+G(leaf,'translate(71 140) rotate(-55) scale(.55)'),
bee:E(80,85,30,19,O)+E(65,57,13,23,W,.8)+E(92,57,13,23,W,.8)+C(112,83,11,D)+P('M63 69v32M80 66v38M97 70v28M109 73l-1-11M118 75l7-9M49 84l-9 3','none',1,2)+C(115,81,2,W)+P('M23 123q15 3 17-9t-15-8q-12 9 7 15 10 3 18-4','none',.5,1),
dragonfly:P('M79 44q-6 66 1 99 7-33 1-99',D)+P('M75 70Q16 10 15 55q2 26 60 28M85 70q59-60 60-15-2 26-60 28M75 85Q25 57 27 97q6 20 48-1M85 85q50-28 48 12-6 20-48-1',W,.9)+P('M26 54l45 23M134 54L89 77M37 92l34 0M123 92H89M76 103h8M76 116h8M78 129h4','none',.6,1)+C(80,43,6,A),
sun:C(80,80,32,O,.85)+C(80,80,24,W,.4)+Array.from({length:16},(_,i)=>G(P('M80 20V9','none',.85,i%2?1:1.8),`rotate(${i*22.5} 80 80)`)).join(''),
lake:E(80,105,69,27,B,.85)+P('M17 100h35M65 91h52M35 113h39M87 119h42M99 105h43M62 132h51','none',.6,1)+G(sprig(),'translate(-13 18) scale(.62)')+G(grass,'translate(109 28) scale(.4)'),
sailboat:P('M77 16v101M77 24L19 103h58Z',W)+P('M85 45l47 58H85Z',B)+P('M18 117h124l-19 24H42Z',A,.8)+P('M27 121h104M53 121l7 15M98 121l-6 15M22 150q17-6 34 0t34 0 34 0','none',.75,1)+P('M79 16l21 6-21 8',O),
gull:P('M13 86Q42 46 80 84q38-38 67 2-34-19-67 7-33-26-67-7Z',W)+P('M48 73q18 1 32 11 14-10 32-11','none',.6,1),
shell:P('M79 140L21 98C-8 51 43 5 79 25c37-20 88 26 59 73Z',B)+P('M79 140V27M79 140L36 37M79 140L22 63M79 140l43-103M79 140l57-77M79 140L58 26M79 140l22-114M68 137h22l9 10H59Z','none',.7,1.1),
waves:P('M7 59q24-24 48 0t48 0 48 0M7 87q24-24 48 0t48 0 48 0M7 115q24-24 48 0t48 0 48 0','none',.9,2)+P('M12 72q20-15 40 0t40 0 40 0','none',.4,1),
lighthouse:P('M59 133l7-74h28l7 74Z',W)+P('M62 103h36l2 18H60ZM65 71h30l2 17H63Z',A,.7)+R(61,39,38,20,B,1)+P('M57 39l23-20 23 20ZM52 61h56M45 134h70','none',1,1.8)+R(75,112,10,21,D,1)+P('M72 42v14M87 42v14M53 33L14 19M107 33l39-14','none',.5,1),
rope:P('M28 119C7 102 20 25 80 22c60 3 73 80 52 97-20 18-52-16-52-39 0 23-32 57-52 39ZM36 111C19 92 36 32 80 32c44 0 61 60 44 79-11 13-44-18-44-31 0 13-33 44-44 31Z',O,.7)+P('M80 80v66M70 143l10-8 10 8','none',1,2),
anchor:P('M80 39v91M54 65h52M27 87q0 51 53 57 53-6 53-57M27 87l-13 14M27 87l14 13M133 87l13 14M133 87l-14 13','none',1,3)+C(80,26,14,B)+C(80,26,7,W),
parasol:P('M13 75a67 67 0 01134 0q-17-10-33 0-17-10-34 0-17-10-34 0-17-10-33 0Z',B)+P('M80 9Q48 36 46 75M80 9q32 27 34 66M80 10v135M57 145h46','none',.9,1.7)+P('M46 75q2-39 34-66v66Z',A,.45),
chair:P('M31 39l29 62 70 10-7 12-75-13-34-67Z',B)+P('M25 39l48 102M132 109L39 143M32 58l52 0M42 78h61M52 98h70M33 41l61-16 38 82','none',1,2)+P('M42 40l26 57M57 37l27 62M73 32l26 70M89 28l26 76','none',.5,1.2),
palm:P('M77 144q7-54 9-91h9q-2 46 0 91Z',O)+P('M91 52Q38 3 14 60q35-20 77-8ZM91 52Q65-8 124 18q-18 0-33 34ZM91 52q65-36 60 19-29-31-60-19ZM91 52q48 12 39 52-12-31-39-52ZM91 52q-47 5-51 44 27-33 51-44Z',L,.75)+P('M84 80h9M83 97h10M81 115h12M79 132h14','none',.5,1),
starfish:P('M80 15q8-3 12 32l5 14 35-3q25 0 9 18l-28 23 10 32q9 25-15 12l-28-21-28 21q-24 13-15-12l10-32-28-23q-16-18 9-18l35 3 5-14q4-35 12-32Z',O,.75)+P('M80 34v68M80 102l43-32M80 102l-43-32M80 102l27 28M80 102l-27 28','none',.45,1)+[[80,61],[80,79],[60,86],[100,86],[65,116],[95,116]].map(([x,y])=>C(x,y,2,W)).join(''),
coral:P('M79 146V48M79 114L40 83V55M40 72L21 57V33M40 58l19-21V22M79 90l37-31V24M116 44l20-12M79 67L61 44M79 127l48-30 10-25M127 97v26M40 84L22 96','none',.85,4),
bottle:P('M61 21h38v10H61ZM66 31v31q-31 12-32 32v43q46 14 92 0V94q-1-20-32-32V31',B,.8)+P('M37 105q44-13 86 0M46 89q5-14 26-18','none',.65,1.2)+R(49,94,62,31,W,3)+G(heart,'translate(67 96) scale(.16)'),
grapes:[[59,48],[83,47],[106,55],[48,71],[72,70],[97,78],[60,95],[83,102],[72,124]].map(([x,y])=>C(x,y,15,A,.75)+P(`M${x-6} ${y-6}q4-4 8-3`,W,.6,1)).join('')+P('M75 33q-5-17 14-24M76 34q-39-27-49-3 26 15 49 3Z',L)+P('M91 26q23-15 32 0 3 17-13 10','none',.9,1.2),
apple:P('M79 52C29 22 11 69 26 111q17 38 53 24 26 8 40-13 28-46-40-70Z',O,.85)+P('M80 51q-2-20 13-31M85 33q20-27 44-12-10 26-44 12Z',L)+P('M41 68q-16 29 2 47','none',.5,1.2),
wheat:P('M80 149V17','none',1,1.5)+Array.from({length:5},(_,i)=>P(`M80 ${47+i*19}q-30-3-28-25 24 0 28 25ZM80 ${38+i*19}q30-3 28-25-24 0-28 25Z`,O,.75)).join('')+P('M51 21l-5-15M109 11l7-9M51 59l-8-10M109 49l7-9','none',.6,1),
basket:P('M26 82h108l-14 61H40Z',O,.6)+P('M32 79q0-59 48-59t48 59M41 76q0-46 39-46t39 46','none',.9,2.1)+P('M28 94h104M31 106h98M34 118h92M37 130h86M47 83l6 59M65 83l3 59M83 83v59M102 83l-4 59M120 83l-7 59','none',.55,1),
barrel:P('M43 22q37-9 74 0 25 60 0 120-37 9-74 0-25-60 0-120Z',O,.65)+E(80,22,37,9,B)+P('M31 52h98M31 64h98M31 101h98M31 113h98M58 32q-13 55 0 110M80 32v115M102 32q13 55 0 110','none',.75,1.4)+C(80,84,7,D),
vine:P('M22 136Q48 35 135 20M61 71q-18-35-36-13 9 28 36 13ZM95 38q5-36 32-26-1 27-32 26ZM42 100q25-25 39-5-14 21-39 5Z',L,.65)+P('M80 50q25-17 27 1 0 13-13 11M58 88q-16-3-19 15','none',.75,1.2),
pear:P('M76 26q-15 0-18 28-4 18-21 41-25 48 42 49 67-1 42-49-17-23-21-41-3-28-24-28Z',O,.7)+P('M76 27q-2-15 11-21M83 20q25-20 40-4-18 22-40 4Z',L)+P('M53 89q-18 33 4 41','none',.5,1),
pumpkin:P('M80 52C37 23 10 70 27 112q14 34 53 23 39 11 53-23 17-42-53-60Z',A,.85)+P('M80 52q-21 40 0 83M63 49q-33 36-10 81M97 49q33 36 10 81M80 51q-8-24 10-33l11 5q-20 10-14 28Z',O,.75)+P('M87 33q23-21 34-4 0 17-15 13','none',.85,1.3),
maple:P('M80 139v-38M80 108L24 93l18-20-24-26 36 7 2-36 24 22 24-22 2 36 36-7-24 26 18 20Z',A,.75)+P('M80 42v66M80 83L54 62M80 96l28-25M80 100L45 89','none',.6,1),
oak:P('M74 139l4-29C32 121 26 99 46 91 14 84 28 60 46 64 20 45 44 27 63 43 52 11 94 9 96 38 121 22 142 47 116 60 146 66 138 92 114 90 134 113 97 122 82 110Z',O,.75)+P('M79 112l4-81M81 73l-29-19M80 95l29-24M80 107l-24-9','none',.65,1),
acorn:P('M46 69h68q-3 57-34 73-31-16-34-73Z',O,.75)+P('M38 70q0-37 42-36 42-1 42 36Z',D,.65)+P('M80 34q-3-17 11-24M54 81q1 27 14 36','none',.7,1.3)+Array.from({length:5},(_,i)=>P(`M${47+i*13} 45l-5 18M${47+i*13} 58l10 7`,'none',.4,1)).join(''),
fence:P('M21 54l9-14 9 14v83H21ZM71 54l9-14 9 14v83H71ZM121 54l9-14 9 14v83h-18Z',O,.65)+P('M9 75h142v11H9ZM9 111h142v10H9Z',B)+P('M28 58v72M78 58v72M128 58v72','none',.5,.9),
witchhat:P('M46 108Q66 56 76 17q24 39 45 90Z',D,.75)+E(80,119,70,18,D,.75)+P('M49 99l65-1 7 10-79 1Z',A)+R(77,97,15,14,O,1)+P('M76 28q0 45 20 69','none',.4,1.1),
bat:P('M80 60l-11-16-1 23Q23 43 13 91q21-9 27 17 23-10 40 26 17-36 40-26 6-26 27-17-10-48-55-24l-1-23Z',D,.7)+P('M29 70q23 12 40 35M131 70q-23 12-40 35','none',.4,1),
mushroom:P('M67 78l-6 60q20 11 39 0l-7-60Z',W)+P('M13 81q8-62 67-61 59-1 67 61Z',A,.7)+E(80,82,67,10,B)+C(45,56,9,W,.8)+C(87,37,7,W,.8)+C(116,62,11,W,.8)+P('M77 94l-3 37M18 83h124','none',.5,1),
bareTree:P('M74 147V48M85 147V70M79 105L37 77V42M37 59L14 42M79 84l37-37V17M116 36l24-13M80 127l45-31 19 3M41 80l-22 12M81 67L66 39V17M110 54l-9-20','none',.9,2.2),
bench:P('M23 46h114v15H23ZM23 69h114v15H23ZM14 96h132v13H14Z',O,.65)+P('M31 45v48M129 45v48M28 109l-7 32M132 109l7 32M29 125h102M27 50h103M27 74h103M18 101h124','none',.85,1.5),
mist:P('M13 47h134M32 65h96M6 84h112M43 102h109M19 122h103','none',.55,2.2)+P('M45 38h52M103 88h42M31 112h49','none',.35,1),
pinecone:P('M80 17C26 41 38 118 80 144c42-26 54-103 0-127Z',O,.65)+Array.from({length:6},(_,i)=>P(`M${55-i%2*8} ${40+i*15}q${25+i%2*8} 20 ${50+i%2*16} 0M${64-i%2*8} ${42+i*15}q16 17 32 0`,'none',.8,1.2)).join('')+P('M80 17l6-12','none',1,1.8),
wreath:C(80,80,55,'none',.9)+C(80,80,44,'none',.5)+Array.from({length:12},(_,i)=>G(G(leaf,'translate(77 30) rotate(-40) scale(.63)')+C(91,31,4,A),`rotate(${i*30} 80 80)`)).join('')+G(bow,'translate(51 108) scale(.37)'),
gift:R(28,65,104,79,B,2)+R(21,50,118,20,A,2)+R(70,50,20,94,O,1)+P('M80 51Q35 47 43 23q9-21 37 28 28-49 37-28 8 24-37 28Z',B)+P('M39 88h23M99 124h21','none',.35,1),
ornament:C(80,94,45,B)+R(70,37,20,14,O,2)+P('M80 37V13M67 13q13-15 26 0M38 79q42 28 84 0M35 102q45 26 90 0','none',.85,1.3)+Array.from({length:5},(_,i)=>G(P('M80 79l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z',O),`translate(${(i-2)*17} ${i%2*6})`)).join(''),
candle:R(62,60,36,78,W,3)+P('M62 71q8 11 14 0 10-12 22 0M80 60V48',B)+P('M80 48q-25-9-6-40-3 15 9 19 14-15 11 2-3 17-14 19Z',O)+E(80,141,56,8,B)+G(leaf,'translate(47 142) rotate(-55) scale(.6)')+G(leaf,'translate(111 141) rotate(52) scale(.6)'),
snowman:C(80,113,37,W)+C(80,66,27,W)+P('M48 46h64M58 46V22h42v24Z',D)+P('M57 85q23 11 47-1v13q-23 9-47 0Z',A)+P('M91 96l16 34-16 5-8-38Z',A)+P('M83 66l23 8-23 3Z',O)+C(71,62,2,D)+C(90,61,2,D)+C(80,109,3,D)+C(80,124,3,D)+P('M68 78q10 5 17 0M45 104L18 81M114 103l26-27M25 89V74M133 83l14 0','none',1,1.3),
santa:P('M36 140q3-63 44-62 41-1 44 62Z',A,.85)+P('M53 43q-8-17 12-27 22-15 45 18l13 10-11 9-27-21-23 23Z',A)+R(50,45,58,12,W,5)+C(120,46,8,W)+E(80,72,26,27,W)+P('M58 72q22 20 44 0-2 43-22 48-20-5-22-48Z',W)+E(80,69,21,13,B)+C(70,65,2,D)+C(90,65,2,D)+C(80,74,5,B)+P('M65 81q7-10 15 0 8-10 15 0M80 121v20',W)+R(40,123,80,10,D,1)+R(72,121,16,14,O,1),
elf:P('M45 141q5-60 35-60 30 0 35 60Z',L)+P('M54 44L85 9l22 34Z',L)+P('M51 44h59v12H51Z',A)+C(85,9,7,O)+C(80,72,23,B)+P('M57 63l-17-5 10 22M103 63l17-5-10 22',B)+C(72,69,2,D)+C(88,69,2,D)+P('M73 79q7 7 14 0M59 97l21 13 21-13',W)+R(47,123,66,8,D,1)+R(74,121,12,12,O,1)+P('M55 140l-15 12M105 140l15 12','none',1,2),
teddy:C(48,38,18,O)+C(112,38,18,O)+E(80,111,35,34,O)+E(42,99,13,25,O)+E(118,99,13,25,O)+E(55,140,18,13,O)+E(105,140,18,13,O)+C(80,59,39,O)+E(80,75,22,16,W)+C(66,55,3,D)+C(94,55,3,D)+P('M73 71q7-8 14 0l-7 7Z',D)+P('M80 78v8M68 85q12 7 24 0','none',1,1)+G(bow,'translate(58 85) scale(.28)'),
workshop:P('M14 79L80 26l66 53Z',L,.7)+R(26,79,108,66,B,1)+R(41,90,26,27,O,1)+R(92,90,26,27,O,1)+R(72,108,16,37,A,1)+P('M54 90v27M41 103h26M105 90v27M92 103h26M30 131h35M94 131h36M17 79q30 11 63-41 33 52 63 41','none',.65,1)+Array.from({length:7},(_,i)=>C(28+i*17,79,3,O)).join(''),
lights:P('M10 43q70 60 140 0','none',.85,1.3)+Array.from({length:7},(_,i)=>{const x=18+i*20,y=52+Math.sin(i/6*Math.PI)*26;return P(`M${x} ${y}v8`,'none',1,1)+E(x,y+14,4,7,i%2?O:A);}).join(''),
};
// Each variant has its own narrative, lead silhouette, supporting cast and layout.
const months=[
{key:'january',label:'Januar',palette:['#729ab4','#dcecf5','#3d5869','#637c70','#b39878','#f9fcfe'],variants:[
['Alpska zima','chalet','mountain','pine','snowflake','pinebranch'],['Na sneznim padinama','skis','mitten','scarf','snowflake','crystal'],['Sanke kroz sumu','sled','pine','pinecone','snowflake','pinebranch'],['Zaledeno jezero','ice','bareTree','moon','crystal','snowflake'],['Mraz i zimski kristali','crystal','snowflake','mountain','pinebranch','star']]},
{key:'february',label:'Februar',palette:['#b57b89','#f2dce0','#77515c','#89967e','#c4a27b','#fffaf5'],variants:[
['Ruze i svilene masne','rose','bow','heart','petal','sprig'],['Kupidonova pisma','cupid','envelope','heart','bow','star'],['Zaljubljene ptice','birds','blossombranch','heart','rose','petal'],['Romanticna terasa','terrace','rose','lantern','bow','sprig'],['Venac ljubavi','heart','rose','envelope','birds','bow']]},
{key:'march',label:'Mart',palette:['#8c87a9','#e5e8e7','#626f70','#8b9d87','#b8a385','#fbfcfa'],variants:[
['Kisa na kaldrmi','umbrella','cobbles','puddle','rain','sprig'],['Prve visibabe','snowdrop','grass','rain','petal','sprig'],['Safran posle kise','crocus','puddle','grass','rain','petal'],['Fenjer u prolece','lantern','cobbles','snowdrop','rain','sprig'],['Prolecna setnja','boots','umbrella','crocus','puddle','rain']]},
{key:'april',label:'April',palette:['#cb9b9b','#f7e6df','#7e776c','#9cb493','#d2b28d','#fffcf7'],variants:[
['Procvetale grane','blossombranch','blossom','petal','sprig','butterfly'],['Vrt leptira','butterfly','wildflower','blossom','petal','sprig'],['Prolecni vocnjak','tree','blossombranch','petal','grass','blossom'],['Vrtna kapija','gate','blossombranch','butterfly','petal','sprig'],['Latice na stazi','petal','cobbles','blossom','butterfly','grass']]},
{key:'may',label:'Maj',palette:['#bf869c','#f5e6ea','#686f58','#8ba377','#c6b287','#fffdf7'],variants:[
['Raskosni bozuri','peony','sprig','petal','butterfly','bee'],['Basta lala','tulip','grass','bee','petal','sprig'],['Pergola u cvetu','gate','rose','peony','blossombranch','butterfly'],['Livada i pcele','bee','daisy','wildflower','grass','tulip'],['Leptiri medu cvecem','butterfly','peony','rose','tulip','sprig']]},
{key:'june',label:'Jun',palette:['#bca159','#f2ecd8','#817d5c','#a4b58a','#dac17e','#fffffa'],variants:[
['Bele rade na suncu','daisy','sun','grass','wildflower','bee'],['Vilini konjici','dragonfly','lake','grass','daisy','sprig'],['Herbarijum ranog leta','wildflower','daisy','grass','sprig','butterfly'],['Mirno jezero','lake','dragonfly','sun','grass','wildflower'],['Zlatna livada','sun','wheat','daisy','wildflower','bee']]},
{key:'july',label:'Jul',palette:['#6c97b1','#e1edf3','#496778','#96a8a1','#c8bda4','#fbfdff'],variants:[
['Jedra na moru','sailboat','waves','gull','sun','rope'],['Obala skoljki','shell','starfish','waves','gull','rope'],['Svetionik i galebovi','lighthouse','gull','waves','shell','sun'],['Letnja terasa','terrace','parasol','shell','sun','waves'],['Mornarski ornamenti','anchor','rope','sailboat','shell','gull']]},
{key:'august',label:'Avgust',palette:['#70a8a4','#e5f1ed','#617e7b','#91ab88','#d9bb7c','#fffaf0'],variants:[
['Suncobran na pesku','parasol','shell','starfish','waves','sun'],['Popodne u lezaljci','chair','parasol','sun','shell','palm'],['Palme i povetarac','palm','waves','sun','gull','shell'],['Morsko blago','starfish','shell','coral','bottle','rope'],['Tirkizni talasi','waves','sailboat','shell','sun','coral']]},
{key:'september',label:'Septembar',palette:['#9e8292','#ede3d2','#79624e','#919374','#c1a46d','#fffcf4'],variants:[
['Vinogradska berba','grapes','vine','barrel','sprig','basket'],['Jabuke u vocnjaku','apple','basket','tree','sprig','pear'],['Zlatna zitna polja','wheat','sun','grass','basket','sprig'],['Korpa sa plodovima','basket','apple','pear','grapes','vine'],['Vinski ornamenti','barrel','grapes','vine','wheat','oak']]},
{key:'october',label:'Oktobar',palette:['#bb8159','#f0e2d2','#805f4b','#929078','#c2a078','#fffbf5'],variants:[
['Bundeve i bakarno lisce','pumpkin','maple','oak','acorn','sprig'],['Fenjeri uz ogradu','lantern','fence','maple','pumpkin','rain'],['Jesenja kisa','umbrella','rain','puddle','oak','maple'],['Tiha oktobarska magla','mist','bareTree','mushroom','acorn','oak'],['Diskretni Halloween','witchhat','bat','pumpkin','moon','maple']]},
{key:'november',label:'Novembar',palette:['#989282','#e8e5df','#736e66','#949780','#b3a285','#fbfaf7'],variants:[
['Klupa u kasnu jesen','bench','bareTree','oak','cobbles','rain'],['Fenjer u magli','lantern','mist','bareTree','puddle','oak'],['Mokre parkovske staze','cobbles','umbrella','rain','bench','maple'],['Jezero u novembru','lake','mist','bareTree','gull','grass'],['Poslednje jesenje lisce','oak','acorn','pinecone','mushroom','bareTree']]},
{key:'december',label:'Decembar',palette:['#a66064','#e3eef5','#536e80','#778e80','#ceae68','#fffcf5'],variants:[
['Deda Mraz i pokloni','santa','gift','sled','snowflake','pinebranch','lights','star'],['Vilenjacka radionica','elf','workshop','teddy','gift','lights','star','bow','pinebranch'],['Jelka u zlatnom svetlu','pine','ornament','candle','gift','star','lights','pinebranch','bow'],['Snesko i zimska carolija','snowman','sled','snowflake','crystal','pine','star','pinebranch','gift'],['Praznicni venac','wreath','gift','ornament','bow','candle','lights','pinebranch','star']]}
];
const arrangements=[
{title:'Botanical sweep',slots:[[27,883,218,-9],[175,930,180,11],[359,955,152,-12],[494,1004,116,16],[636,1039,80,-12],[9,1010,127,19],[46,925,100,-35],[249,1029,98,-22],[397,1050,89,25]]},
{title:'Ornamental medallion',slots:[[280,930,190,0],[171,989,145,-28],[448,988,137,25],[33,1010,124,-9],[612,1006,114,16],[203,1049,77,0],[516,1050,72,-15],[327,867,79,0],[354,1043,76,0]]},
{title:'Seasonal ribbon',slots:[[17,930,183,-4],[194,991,138,8],[337,932,181,-5],[507,992,128,12],[633,940,150,-6],[102,1023,101,-22],[433,1028,106,18],[9,873,110,-25],[690,866,112,28]]},
{title:'Asymmetric vignette',slots:[[35,930,210,-7],[225,984,148,13],[649,906,164,7],[694,839,132,-18],[716,746,94,20],[611,1017,156,-15],[368,1033,115,-8],[488,1055,79,10],[704,656,98,-23]]},
{title:'Corner atelier',slots:[[6,929,197,-12],[565,923,197,14],[132,1009,150,21],[447,1016,141,-22],[291,1057,71,-18],[383,1055,80,10],[3,858,112,-28],[684,844,126,28],[151,926,94,22]]}
];
const uprightMotifs=new Set(['chalet','skis','mitten','scarf','cupid','terrace','umbrella','lantern','snowdrop','crocus','boots','tree','gate','tulip','wildflower','sailboat','lighthouse','anchor','parasol','chair','palm','bottle','grapes','apple','wheat','basket','barrel','pear','pumpkin','fence','witchhat','mushroom','bareTree','bench','candle','snowman','santa','elf','teddy','workshop']);
function stamp(name,x,y,size,rotation=0,opacity=1){if(!motifs[name])throw Error(`Unknown motif ${name}`);if(size>85&&uprightMotifs.has(name))rotation=Math.max(-4,Math.min(4,rotation));return `<g data-motif="${name}" transform="translate(${x} ${y}) rotate(${rotation} ${size/2} ${size/2}) scale(${size/160})" opacity="${opacity}">${motifs[name]}</g>`;}
function sparkle(x,y,r=4){return P(`M${x-r} ${y}h${r*2}M${x} ${y-r}v${r*2}`,'none',.6,.8);}
function flourish(x,y,flip=false){return G(P('M0 0q39-21 77 0t77 0M8 0q19-15 31 0-12 15-23 1M146 0q-19-15-31 0 12 15 23 1','none',.65,.8),`translate(${x} ${y}) ${flip?'scale(-1 1)':''}`);}

function mix(hex,target,amount){
 const a=parseInt(hex.slice(1),16),b=parseInt(target.slice(1),16);
 const rgb=[16,8,0].map(shift=>Math.round(((a>>shift)&255)*(1-amount)+((b>>shift)&255)*amount));
 return '#'+rgb.map(c=>c.toString(16).padStart(2,'0')).join('');
}
function materialDefinitions(id,palette){
 const roles=['accent','light','deep','leaf','gold','paper'];
 let defs=roles.map((role,i)=>{
  const color=palette[i];
  return '<linearGradient id="ink-'+id+'-'+role+'" x1="0" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="'+mix(color,'#ffffff',role==='light'?.55:.3)+'"/><stop offset="0.52" stop-color="'+color+'"/><stop offset="1" stop-color="'+mix(color,palette[2],role==='paper'?.02:.12)+'"/></linearGradient>';
 }).join('');
 defs+='<radialGradient id="wash-'+id+'"><stop offset="0" stop-color="'+palette[1]+'" stop-opacity="0.72"/><stop offset="0.65" stop-color="'+palette[1]+'" stop-opacity="0.3"/><stop offset="1" stop-color="'+palette[5]+'" stop-opacity="0"/></radialGradient>';
 return defs;
}
function backdrop(id,variant){
 const fill='url(#wash-'+id+')';
 const backdrops=[
  E(184,1040,290,151,fill),
  E(370,1027,214,134,fill),
  E(390,1095,495,145,fill),
  E(102,1040,207,136,fill)+E(770,987,91,219,fill),
  E(92,1045,202,139,fill)+E(681,1045,198,141,fill)
 ];
 return '<g stroke="none">'+backdrops[variant]+'</g>';
}
function designName(name){
 const words={sneznim:'snežnim',sumu:'šumu',Zaledeno:'Zaleđeno',Ruze:'Ruže',masne:'mašne',Romanticna:'Romantična',Kisa:'Kiša',kise:'kiše',Safran:'Šafran',Prolecna:'Prolećna',setnja:'šetnja',Prolecni:'Prolećni',vocnjak:'voćnjak',Procvetale:'Procvetale',Raskosni:'Raskošni',bozuri:'božuri',Basta:'Bašta',pcele:'pčele',cvecem:'cvećem',medu:'među',Zlatna:'Zlatna',zelja:'želja',skoljki:'školjki',Suncobran:'Suncobran',lezaljci:'ležaljci',vocnjaku:'voćnjaku',zitna:'žitna',lisce:'lišće',Fenjeri:'Fenjeri',magla:'magla',Poslednje:'Poslednje',Vilenjacka:'Vilenjačka',Snesko:'Sneško',carolija:'čarolija',Praznicni:'Praznični',snezna:'snežna'};
 return name.replace(/[A-Za-z]+/g,word=>words[word]||word);
}

function build(month,variant){
const [rawTitle,...cast]=month.variants[variant],title=designName(rawTitle),layout=arrangements[variant];let decor='',foliageDecor='';
if(variant===0){decor+=P('M-14 1068Q37 950 2 732M39 1110Q258 1006 527 1118','none',.28,1.2);for(let i=0;i<9;i++)decor+=G(leaf,`translate(${12+i*48} ${1100-18*Math.sin(i/8*Math.PI)}) rotate(${i%2?-45:50}) scale(.53)`,.55);}
else if(variant===1){decor+=E(367,1028,171,91,'none',.35)+E(367,1028,180,97,'none',.2)+flourish(28,1024)+flourish(767,1024,true)+P('M22 1097H195M538 1097h234','none',.3,.8);}
else if(variant===2){decor+=P('M0 1103Q200 1057 400 1100T794 1090','none',.28,1)+P('M0 1113Q200 1067 400 1110T794 1100','none',.18,.7);for(let i=0;i<17;i++)decor+=C(16+i*47,1110-13*Math.sin(i*.6),1.5,O,.6);}
else if(variant===3){decor+=P('M774 639v431q0 25-25 25H344M784 689v384q0 32-32 32H397','none',.3,.9)+flourish(41,1097);for(let i=0;i<6;i++)decor+=sparkle(771,683+i*62,3);}
else{decor+=P('M14 1020v89h196M780 1014v95H585M14 849v-86M780 846v-83','none',.4,.9)+P('M22 1056v45h157M772 1056v45H615','none',.25,.7)+flourish(319,1104);}
layout.slots.forEach(([x,y,size,r],i)=>decor+=stamp(i===0?cast[0]:cast[1+(i-1)%(cast.length-1)],x,y,size,r,i<6?1:.85));
if(month.key==='december'){cast.slice(5).forEach((name,i)=>decor+=stamp(name,143+i*148,895+(i%2)*28,88,i%2?14:-12,.8));for(let i=0;i<14;i++)decor+=sparkle(23+i*57,1000+(i%3)*36,2.5+i%2);}
else{for(let i=0;i<10;i++)decor+=sparkle(27+i*81,1087-(i%3)*19,2.5);}

// A coherent, hand-arranged supporting layer; never repeat the lead character.
const foliage={january:'pinebranch',february:'sprig',march:'grass',april:'blossombranch',may:'sprig',june:'grass',july:'rope',august:'coral',september:'vine',october:'oak',november:'bareTree',december:'pinebranch'}[month.key];
const satellites={january:'snowflake',february:'petal',march:'rain',april:'petal',may:'petal',june:'daisy',july:'gull',august:'shell',september:'wheat',october:'maple',november:'oak',december:'star'}[month.key];
const clusters=[[[23,957,-36],[145,1001,15],[344,1045,-23],[531,1035,18]],[[178,1002,-44],[455,1002,42],[40,1052,-30],[649,1052,30]],[[12,1010,-32],[208,1022,25],[400,1039,-21],[618,1020,29]],[[20,1003,-37],[156,1050,21],[678,940,33],[640,1029,-24]],[[1,1004,-30],[130,1034,35],[573,1020,-35],[690,976,30]]][variant];
clusters.forEach(([x,y,r])=>foliageDecor+=stamp(foliage,x,y,107,r,.75));
// Small separate accents carry the month along the frame without chopped silhouettes.
for(let i=0;i<5;i++){
  const x=84+i*147,y=925+((i+variant)%3)*38;
  decor+=stamp(satellites,x,y,35+i%2*10,i%2?24:-19,.65);
}
// Five different top ornaments: a light garland, central crest, waves, corner and paired flourishes.
if(variant===0){decor+=P('M0 7Q105 39 212 5','none',.25,.8);[5,47,89,131,173].forEach((x,i)=>decor+=stamp(satellites,x,3,22,i%2?20:-20,.35));}
else if(variant===1){decor+=flourish(190,14)+flourish(604,14,true)+stamp(satellites,381,0,30,0,.4);}
else if(variant===2){decor+=P('M0 10Q100 31 200 10T400 10T600 10T794 10','none',.2,.7);[12,199,387,575,759].forEach(x=>decor+=stamp(satellites,x,4,23,10,.32));}
else if(variant===3){decor+=P('M784 7H680M784 7v170','none',.3,.8)+stamp(satellites,744,10,31,20,.4);}
else{decor+=flourish(22,13)+flourish(772,13,true)+stamp(satellites,13,5,25,-15,.35)+stamp(satellites,756,5,25,15,.35);}
// Quiet outer-edge rhythm, with complete tiny motifs contained in the margin.
for(let i=0;i<5;i++){
  const y=170+i*134+variant*8;
  decor+=stamp(satellites,3,y,18,-15,.25)+stamp(satellites,774,y+55,17,15,.22);
}
const id=`${month.key}-${variant+1}`;
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="794" height="1123" viewBox="0 0 794 1123" role="img" aria-labelledby="title-${id}"><title id="title-${id}">${month.label} - ${title}</title><desc>Original seasonal vector motifs. ${layout.title}. Open invoice content area.</desc><defs><linearGradient id="paper-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.78" stop-color="#ffffff"/><stop offset="1" stop-color="@paper"/></linearGradient><mask id="safe-${id}"><rect width="794" height="1123" fill="white"/><rect x="29" y="87" width="736" height="780" rx="15" fill="black"/></mask></defs><rect width="794" height="1123" fill="url(#paper-${id})"/><g stroke="@deep" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none" mask="url(#safe-${id})">${backdrop(id,variant)}${foliageDecor}${decor}</g></svg>`;
svg=svg.replace('<defs>','<defs>'+materialDefinitions(id,month.palette));
['accent','light','deep','leaf','gold','paper'].forEach((token,i)=>{
 svg=svg.replaceAll('fill="@'+token+'"','fill="url(#ink-'+id+'-'+token+')"');
 svg=svg.replaceAll('@'+token,month.palette[i]);
});return{svg,title,cast,layout:layout.title};}
const manifest=[];
for(const month of months){const entries=[];for(let v=0;v<5;v++){const artwork=build(month,v),file=`${String(v+1).padStart(2,'0')}-${month.key}.svg`;fs.writeFileSync(path.join(output,file),artwork.svg+'\n');entries.push({file,name:artwork.title,motifs:artwork.cast,composition:artwork.layout});}manifest.push({month:month.key,label:month.label,palette:month.palette,variants:entries});}
fs.writeFileSync(path.join(review,'invoice-motifs.json'),JSON.stringify(manifest,null,2)+'\n');
const mock=`<div class="sample"><header><strong>INVOICE</strong><span>INV-2026-024<br>Issue date: 02.10.2026</span></header><div class="parties"><div><b>FROM</b><p>Studio North<br>Belgrade, Serbia<br>hello@studio.example</p></div><div><b>BILL TO</b><p>Client Company<br>London, UK<br>accounts@client.example</p></div></div><table><thead><tr><th>Description</th><th>Hours</th><th>Amount</th></tr></thead><tbody><tr><td>Design services</td><td>80</td><td>2,400.00</td></tr><tr><td>Development</td><td>40</td><td>1,600.00</td></tr><tr><td>Consulting</td><td>12</td><td>600.00</td></tr></tbody></table><div class="total">Total to pay <strong>EUR 4,600.00</strong></div><div class="note"><b>NOTE</b><p>Thank you for your business.<br>Payment due within 14 days.</p></div></div>`;
const cards=manifest.map(m=>`<section id="${m.month}"><h2>${m.label}<span>${m.palette.slice(0,5).map(c=>`<i style="background:${c}"></i>`).join('')}</span></h2><div class="designs">${m.variants.map((v,i)=>`<article><div class="caption"><b>0${i+1}</b> ${v.name}</div><a class="page" href="../public/invoice-motifs/${v.file}" target="_blank"><img src="../public/invoice-motifs/${v.file}" alt="${m.label}: ${v.name}">${mock}</a><div class="detail"><img src="../public/invoice-motifs/${v.file}" alt="Detalj motiva"></div><small>${v.motifs.length} vrsta sezonskih motiva</small></article>`).join('')}</div></section>`).join('');
const html=`<!doctype html><html lang="sr"><meta charset="utf-8"><title>Sezonski motivi - 60 originalnih dizajna</title><style>*{box-sizing:border-box}body{margin:0;padding:38px;background:#f1f0ec;color:#283238;font:14px system-ui,sans-serif}h1{font:36px Georgia,serif;margin:0 0 8px}.intro{color:#687277;margin:0 0 20px}nav{display:flex;gap:7px;flex-wrap:wrap;margin:16px 0 28px}nav a,button{border:1px solid #d6d8d4;border-radius:6px;background:#fff;padding:8px 13px;color:#354348;text-decoration:none;cursor:pointer}h2{font:26px Georgia,serif;display:flex;align-items:center;gap:20px;margin:0 0 17px}h2 span{display:flex;gap:5px}i{display:inline-block;width:15px;height:15px;border-radius:50%}section{margin:38px 0 52px;scroll-margin-top:20px}.designs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:18px}.caption{min-height:40px;font-size:12px;line-height:1.4}.caption b{color:#899394;margin-right:5px}.page{display:block;position:relative;aspect-ratio:794/1123;background:#fff;box-shadow:0 7px 22px #202d3610;overflow:hidden;border-radius:3px}.page>img{display:block;width:100%;height:100%}.detail{margin-top:12px;aspect-ratio:794/245;position:relative;background:#fff;overflow:hidden;border:1px solid #e5e6df;border-radius:3px}.detail img{position:absolute;width:100%;bottom:0}small{display:block;margin-top:9px;color:#788183;font-size:10px;line-height:1.5}.sample{display:none;position:absolute;inset:0;padding:4%;font-size:clamp(4px,.4vw,6px);color:#28343e}.with-content .sample{display:block}.sample header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #dce1e3;padding:3% 0 5%;line-height:1.6}.sample header strong{font-size:clamp(10px,1.4vw,22px);letter-spacing:-.04em}.parties{display:grid;grid-template-columns:1fr 1fr;gap:4%;margin:5% 0}.parties>div{padding:6%;border:1px solid #e6e9e8;border-radius:8px;background:#ffffffee}.parties b,.note b{font-size:.9em;letter-spacing:.1em;color:#7d9096}.parties p{line-height:1.6}table{width:100%;border-collapse:collapse;text-align:left}th{background:#f3f5f4}td,th{padding:3% 3%;border-bottom:1px solid #e7ebea}td:nth-child(n+2),th:nth-child(n+2){text-align:right}.total{margin:5% 0 5% auto;width:60%;padding:5%;background:#f4f6f5;border-radius:7px;line-height:1.9}.total strong{display:block;font-size:1.4em}.note{background:#ffffffee;border:1px solid #e6e9e8;border-radius:7px;padding:4%;line-height:1.6}@media(max-width:1000px){.designs{grid-template-columns:repeat(2,minmax(0,1fr))}.sample{font-size:8px}}@media print{body{background:white}.controls,nav{display:none}section{break-inside:avoid}}</style><h1>Sezonski motivi</h1><p class="intro">12 meseci · 60 zasebnih kompozicija · originalni vektorski crtezi. Klik na stranicu otvara SVG u punoj velicini.</p><div class="controls"><button onclick="document.body.classList.toggle('with-content')">Prikazi / sakrij primer racuna</button></div><nav>${manifest.map(m=>`<a href="#${m.month}">${m.label}</a>`).join('')}</nav>${cards}</html>`;
fs.writeFileSync(path.join(review,'motif-gallery.html'),html);
console.log(`Generated ${manifest.length*5} original compositions from ${Object.keys(motifs).length} new vector motifs.`);

const catalog=Object.fromEntries(manifest.map(m=>[m.month,{palette:m.palette,names:m.variants.map(v=>v.name)}]));
fs.mkdirSync(path.join(root,'src/data'),{recursive:true});
fs.writeFileSync(path.join(root,'src/data/invoiceMotifs.json'),JSON.stringify(catalog,null,2)+'\n');
