// Mock NHL roster data for all 32 teams
import type { TeamRoster, RosterPlayer } from './nhlApi';

const p = (id: number, first: string, last: string, num: number, pos: string): RosterPlayer => ({
  id, headshot: `https://assets.nhle.com/mugs/nhl/20232024/${id}.png`,
  firstName: { default: first }, lastName: { default: last }, sweaterNumber: num, positionCode: pos,
  shootsCatches: pos === 'G' ? 'L' : 'R', heightInInches: 72, weightInPounds: 200
});

// Generate basic roster for teams
const genRoster = (baseId: number): TeamRoster => {
  const fwd = Array.from({length:12}, (_,i) => p(baseId+i, 'F', 'Player'+(i+1), i+1, i%3===0?'C':i%3===1?'L':'R'));
  const def = Array.from({length:6}, (_,i) => p(baseId+12+i, 'D', 'Player'+(i+13), i+13, 'D'));
  const goa = Array.from({length:2}, (_,i) => p(baseId+18+i, 'G', 'Player'+(i+19), i+31, 'G'));
  return { forwards: fwd, defensemen: def, goalies: goa, roster: [] };
};

export const mockRosters: Record<string, TeamRoster> = {
  // Detailed rosters
  VAN: { forwards: [
    p(8478402,'Elias','Pettersson',40,'C'), p(8477500,'J.T.','Miller',9,'C'), p(8480012,'Brock','Boeser',6,'R'),
    p(8481617,'Conor','Garland',8,'R'), p(8481471,'Andrei','Kuzmenko',96,'L'), p(8478420,'Nils','Hoglander',21,'L'),
    p(8477346,'Pius','Suter',24,'C'), p(8479325,'Dakota','Joshua',81,'R'), p(8478444,'Teddy','Blueger',53,'C'),
    p(8476456,'Ilya','Mikheyev',65,'R'), p(8478469,'Phillip','Di Giuseppe',34,'L'), p(8475786,'Sam','Lafferty',71,'C')
  ], defensemen: [
    p(8474600,'Quinn','Hughes',43,'D'), p(8478104,'Filip','Hronek',17,'D'), p(8474565,'Tyler','Myers',57,'D'),
    p(8477365,'Carson','Soucy',7,'D'), p(8479362,'Ian','Cole',28,'D'), p(8478104,'Noah','Juulsen',48,'D')
  ], goalies: [
    p(8475883,'Thatcher','Demko',35,'G'), p(8476999,'Casey','DeSmith',29,'G'), p(8480849,'Arturs','Silovs',31,'G')
  ], roster: [] },
  
  TOR: { forwards: [
    p(8479318,'Auston','Matthews',34,'C'), p(8479357,'Mitchell','Marner',16,'R'), p(8475726,'John','Tavares',91,'C'),
    p(8477939,'William','Nylander',88,'R'), p(8479343,'Matthew','Knies',23,'L'), p(8480073,'Bobby','McMann',74,'L'),
    p(8478493,'Calle','Jarnkrok',19,'C'), p(8476346,'Max','Domi',11,'C'), p(8476918,'Tyler','Bertuzzi',59,'L'),
    p(8478439,'David','Kampf',64,'C'), p(8480073,'Pontus','Holmberg',29,'C'), p(8475786,'Ryan','Reaves',75,'R')
  ], defensemen: [
    p(8474600,'Morgan','Rielly',44,'D'), p(8480078,'Jake','McCabe',22,'D'), p(8480069,'Chris','Tanev',8,'D'),
    p(8479410,'Oliver','Ekman-Larsson',21,'D'), p(8478104,'Simon','Benoit',2,'D'), p(8480248,'Conor','Timmins',25,'D')
  ], goalies: [
    p(8476999,'Joseph','Woll',60,'G'), p(8479361,'Anthony','Stolarz',41,'G'), p(8475883,'Matt','Murray',30,'G')
  ], roster: [] },
  
  EDM: { forwards: [
    p(8478402,'Connor','McDavid',97,'C'), p(8477934,'Leon','Draisaitl',29,'C'), p(8477933,'Ryan','Nugent-Hopkins',93,'C'),
    p(8478402,'Zach','Hyman',18,'L'), p(8480803,'Jeff','Skinner',53,'L'), p(8478104,'Viktor','Arvidsson',33,'R'),
    p(8478910,'Vasily','Podkolzin',92,'R'), p(8479325,'Mattias','Janmark',13,'L'), p(8478444,'Adam','Henrique',19,'C'),
    p(8476456,'Corey','Perry',90,'R'), p(8478469,'Connor','Brown',28,'R'), p(8475786,'Derek','Ryan',10,'C')
  ], defensemen: [
    p(8480069,'Evan','Bouchard',2,'D'), p(8474600,'Mattias','Ekholm',14,'D'), p(8478104,'Darnell','Nurse',25,'D'),
    p(8477365,'Brett','Kulak',27,'D'), p(8479362,'Troy','Stecher',70,'D'), p(8478104,'Ty','Emberson',57,'D')
  ], goalies: [
    p(8475883,'Stuart','Skinner',74,'G'), p(8476999,'Calvin','Pickard',30,'G')
  ], roster: [] },
  
  // All other 29 teams with generated rosters
  ANA: genRoster(1000000), BOS: genRoster(1100000), BUF: genRoster(1200000), CAR: genRoster(1300000),
  CBJ: genRoster(1400000), CGY: genRoster(1500000), CHI: genRoster(1600000), COL: genRoster(1700000),
  DAL: genRoster(1800000), DET: genRoster(1900000), FLA: genRoster(2000000), LAK: genRoster(2100000),
  MIN: genRoster(2200000), MTL: genRoster(2300000), NJD: genRoster(2400000), NSH: genRoster(2500000),
  NYI: genRoster(2600000), NYR: genRoster(2700000), OTT: genRoster(2800000), PHI: genRoster(2900000),
  PIT: genRoster(3000000), SEA: genRoster(3100000), SJS: genRoster(3200000), STL: genRoster(3300000),
  TBL: genRoster(3400000), UTA: genRoster(3500000), VGK: genRoster(3600000), WPG: genRoster(3700000),
  WSH: genRoster(3800000)
};

export const getMockRoster = (teamAbbrev: string): TeamRoster | null => mockRosters[teamAbbrev] || null;
