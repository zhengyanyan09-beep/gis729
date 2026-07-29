export const bloodCenter = {
  id: 'BC01',
  name: '上海市血液中心',
  address: '虹桥路1191号',
  coordinates: [121.4027198, 31.1997915],
}

export const hospitals = [
  { id: 'H01', name: '上海市同仁医院', address: '仙霞路1111号', coordinates: [121.3724193, 31.2109616], groundTime: 29 },
  { id: 'H02', name: '中国人民解放军第四五五医院', address: '淮海西路338号', coordinates: [121.4232172, 31.2023097], groundTime: 24 },
  { id: 'H03', name: '上海市胸科医院', address: '淮海西路241号', coordinates: [121.421569, 31.1996563], groundTime: 22 },
  { id: 'H04', name: '长宁区妇幼保健院', address: '武夷路773号', coordinates: [121.4099654, 31.2149782], groundTime: 20 },
  { id: 'H05', name: '上海电力医院', address: '延安西路937号', coordinates: [121.42727, 31.2161351], groundTime: 31 },
  { id: 'H06', name: '长宁区天山中医医院', address: '娄山关路868号', coordinates: [121.4010046, 31.2165861], groundTime: 18 },
  { id: 'H07', name: '中国人民解放军第八五医院', address: '华山路1328号', coordinates: [121.4358, 31.2114], groundTime: 29 },
  { id: 'H08', name: '武警上海市总队医院', address: '虹许路831号', coordinates: [121.3892, 31.1918], groundTime: 25 },
  { id: 'H09', name: '上海市光华中西医结合医院', address: '新华路540号', coordinates: [121.4241, 31.2102], groundTime: 27 },
  { id: 'H10', name: '上海港华医院', address: '淮海西路282号', coordinates: [121.4222, 31.2013], groundTime: 23 },
  { id: 'H11', name: '上海神州医院', address: '仙霞西路601号', coordinates: [121.3518, 31.2095], groundTime: 38 },
  { id: 'H12', name: '长宁区精神卫生中心', address: '协和路299号', coordinates: [121.3594, 31.2255], groundTime: 36 },
]

export const stations = [
  { id: 'S01', name: '血液中心起降点', coordinates: [121.4029, 31.2002], radius: 5.2 },
  { id: 'S02', name: '临空备用起降点', coordinates: [121.3668, 31.2115], radius: 4.2 },
  { id: 'S03', name: '东部医疗转运起降点', coordinates: [121.4318, 31.2098], radius: 4.5 },
]

export const drones = [
  { id: 'UAV-01', load: 3, battery: 80, cold: true, status: '空闲' },
  { id: 'UAV-02', load: 5, battery: 86, cold: true, status: '空闲' },
  { id: 'UAV-03', load: 10, battery: 92, cold: false, status: '空闲' },
  { id: 'UAV-04', load: 5, battery: 75, cold: true, status: '执行中' },
  { id: 'UAV-05', load: 3, battery: 68, cold: true, status: '空闲' },
  { id: 'UAV-06', load: 8, battery: 88, cold: true, status: '空闲' },
  { id: 'UAV-07', load: 5, battery: 45, cold: false, status: '维护中' },
  { id: 'UAV-08', load: 10, battery: 95, cold: true, status: '空闲' },
]

export const supplyNodes = [
  { id: 'BC01', name: '上海市血液中心', type: '真实供血机构', address: '虹桥路1191号', coordinates: [121.4027198, 31.1997915], inventory: 86 },
  { id: 'BC02', name: '西部应急血液转运点', type: '规划前置节点', address: '临空片区规划点', coordinates: [121.3572, 31.2168], inventory: 54 },
  { id: 'BC03', name: '东部应急血液转运点', type: '规划前置节点', address: '新华片区规划点', coordinates: [121.4308, 31.212], inventory: 63 },
]

export const restrictions = [
  {
    id: 'R01',
    name: '教学模拟临时管制区',
    coordinates: [[
      [121.4098, 31.1978], [121.4144, 31.1978], [121.4144, 31.204],
      [121.4098, 31.204], [121.4098, 31.1978],
    ]],
  },
  {
    id: 'R02',
    name: '教学模拟高密建筑区',
    coordinates: [[
      [121.391, 31.207], [121.396, 31.207], [121.396, 31.213],
      [121.391, 31.213], [121.391, 31.207],
    ]],
  },
]
