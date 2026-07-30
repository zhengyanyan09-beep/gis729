<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import mapboxgl from 'mapbox-gl'
import * as turf from '@turf/turf'
import * as echarts from 'echarts'
import { hospitals, stations, drones, restrictions, supplyNodes } from './projectData'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || ''

const ROLE = { DISPATCH:'调度中心', HOSPITAL:'医院工作台', OPERATOR:'无人机运营中心' }
const LOGIN_ROLES = [ROLE.DISPATCH,ROLE.HOSPITAL,ROLE.OPERATOR]
const role = ref('')
const loginRole = ref(ROLE.DISPATCH)
const loginPassword = ref('')
const loginOrg = ref('H01')
const isLoggedIn = ref(false)
const showRegister = ref(false)
const registerMessage = ref('')
const registerForm = ref({name:'',type:'医院',district:'长宁区',address:'',contact:''})
const districtCenters={'黄浦区':[121.4903,31.2228],'徐汇区':[121.4368,31.1883],'长宁区':[121.4246,31.2204],'静安区':[121.4484,31.2288],'普陀区':[121.3955,31.2494],'虹口区':[121.5051,31.2646],'杨浦区':[121.526,31.2595],'闵行区':[121.3817,31.1128],'宝山区':[121.4896,31.4055],'嘉定区':[121.2653,31.3756],'浦东新区':[121.5447,31.2215],'金山区':[121.3425,30.7416],'松江区':[121.2277,31.0323],'青浦区':[121.1242,31.1507],'奉贤区':[121.4739,30.9177],'崇明区':[121.3975,31.6236]}
const page = ref('overview')
const capacityPage = computed(()=>(page.value==='fleet'&&role.value===ROLE.DISPATCH)||(page.value==='architecture'&&role.value===ROLE.OPERATOR))
const notice = ref('')
const showMessages = ref(false)
const mapMode = ref('2d')
const rememberBasemap = ref(localStorage.getItem('medical-basemap-remember-v1')==='true')
const basemap = ref(rememberBasemap.value?(localStorage.getItem('medical-basemap-v1')||'dark'):'dark')
const basemapOptions = {
  dark:{name:'科技暗色（默认）',style:'mapbox://styles/mapbox/dark-v11'},
  streets:{name:'标准街道',style:'mapbox://styles/mapbox/streets-v12'},
  light:{name:'简洁浅色',style:'mapbox://styles/mapbox/light-v11'},
  satellite:{name:'卫星影像',style:'mapbox://styles/mapbox/satellite-streets-v12'}
}
const rotateMode = ref(false)
const mapBearing = ref(0)
const mapPitch = ref(0)
const mapZoom = ref(9.45)
const poiLevel = ref('城区资源')
const followDrone = ref(true)
const selectedTaskId = ref('')
const dispatchStep = ref(1)
const selectedSupplierId = ref('')
const selectedDroneId = ref('')
const selectedRoute = ref('safe')
const selectedBatchTaskIds = ref([])
const supplierListExpanded = ref(false)
const deliveryMode = ref('air')
const trafficLoading = ref(false)
const trafficStatus = ref('等待获取道路交通数据')
const groundMinutes = ref(null)
const groundDistance = ref(null)
const chartEl = ref()
const windCanvas = ref()
const asideEl = ref()
const layerVisible = ref({ hospitals:true, supply:true, bases:true, coverage:false, restrictions:true, weather:true, ground:true, air:true, buildings:true })
const weatherLoading = ref(false)
const windCanvasVisible = ref(false)
const windLevel = ref('surface')
const weatherCollapsed = ref(true)
const weather = ref({temperature:26,windSpeed:3.6,windDirection:110,gust:6.2,precipitation:0,visibility:18,code:1,source:'仿真备用',updatedAt:'--'})
const weatherGrid = ref([])
const routeWeather = ref([])
const materialOptions=[
  'A型 Rh+ 红细胞','A型 Rh- 红细胞','B型 Rh+ 红细胞','B型 Rh- 红细胞',
  'AB型 Rh+ 红细胞','AB型 Rh- 红细胞','O型 Rh+ 红细胞','O型 Rh- 红细胞',
  'A型血浆','B型血浆','AB型血浆','O型血浆','血小板','冷沉淀凝血因子',
  '全血','人血白蛋白','凝血因子制剂','急救药品'
]
const requestForm = ref({
  selectedMaterials:[{name:'A型 Rh+ 红细胞',amount:2,unit:'U'}],
  customMaterial:'',customAmount:1,customUnit:'件',deadline:30,priority:'一级紧急',
  preferredSupplier:'AUTO',note:'急诊手术备血',cold:true
})
const newDrone = ref({ id:'', load:5, battery:100, range:25, cold:true, baseId:stations[0].id })
const flightTelemetry = ref(JSON.parse(localStorage.getItem('medical-telemetry-v3') || 'null') || { taskId:'', stage:'待命', progress:0, longitude:null, latitude:null, battery:100, temperature:4.2, altitude:0, speed:0, eta:'--' })

const inventory = ref(JSON.parse(localStorage.getItem('medical-inventory-v3') || 'null') || [
  { orgId:'BC01', org:'上海市血液中心', type:'血站', coordinates:[121.4027198,31.1997915], items:{'A型 Rh+ 红细胞':42,'O型 Rh- 红细胞':12,'血小板':18,'急救药品':26}, online:true },
  { orgId:'H01', org:hospitals[0].name, type:'医院', coordinates:hospitals[0].coordinates, items:{'A型 Rh+ 红细胞':8,'O型 Rh- 红细胞':2,'血小板':4,'急救药品':31}, online:true },
  { orgId:'H03', org:hospitals[2].name, type:'医院', coordinates:hospitals[2].coordinates, items:{'A型 Rh+ 红细胞':15,'O型 Rh- 红细胞':5,'血小板':9,'急救药品':18}, online:true },
  { orgId:'H05', org:hospitals[4].name, type:'医院', coordinates:hospitals[4].coordinates, items:{'A型 Rh+ 红细胞':5,'O型 Rh- 红细胞':0,'血小板':3,'急救药品':46}, online:true },
])
const officialBloodNodes=[
  { orgId:'BC02', org:'中国人民解放军上海血液中心', type:'血站', address:'杨浦区长海路168号', coordinates:[121.5248,31.3088], items:{'A型 Rh+ 红细胞':36,'O型 Rh- 红细胞':9,'血小板':15,'急救药品':18}, online:true, dataType:'机构真实·库存仿真' },
  { orgId:'BC03', org:'浦东新区血站', type:'血站', address:'浦东新区东建路531号', coordinates:[121.5325,31.2036], items:{'A型 Rh+ 红细胞':31,'O型 Rh- 红细胞':7,'血小板':13,'急救药品':20}, online:true, dataType:'机构真实·库存仿真' },
  { orgId:'BC04', org:'嘉定区血站', type:'血站', address:'嘉定区洪德路1055号', coordinates:[121.2495,31.3417], items:{'A型 Rh+ 红细胞':27,'O型 Rh- 红细胞':6,'血小板':11,'急救药品':17}, online:true, dataType:'机构真实·库存仿真' },
  { orgId:'BC05', org:'松江区血站', type:'血站', address:'松江区文诚路801号3号楼', coordinates:[121.2144,31.0355], items:{'A型 Rh+ 红细胞':29,'O型 Rh- 红细胞':8,'血小板':12,'急救药品':19}, online:true, dataType:'机构真实·库存仿真' },
  { orgId:'BC06', org:'青浦应急供血前置点（规划）', type:'血站', address:'青浦新城规划医疗节点', coordinates:[121.1189,31.1586], items:{'A型 Rh+ 红细胞':22,'O型 Rh- 红细胞':5,'血小板':9,'急救药品':14}, online:true, dataType:'规划节点·库存仿真' },
  { orgId:'BC07', org:'嘉定应急供血前置点（规划）', type:'血站', address:'嘉定新城规划医疗节点', coordinates:[121.2541,31.3868], items:{'A型 Rh+ 红细胞':24,'O型 Rh- 红细胞':6,'血小板':10,'急救药品':15}, online:true, dataType:'规划节点·库存仿真' },
  { orgId:'BC08', org:'奉贤应急供血前置点（规划）', type:'血站', address:'奉贤新城规划医疗节点', coordinates:[121.4818,30.9112], items:{'A型 Rh+ 红细胞':21,'O型 Rh- 红细胞':5,'血小板':8,'急救药品':16}, online:true, dataType:'规划节点·库存仿真' },
  { orgId:'BC09', org:'金山应急供血前置点（规划）', type:'血站', address:'金山新城规划医疗节点', coordinates:[121.3508,30.7505], items:{'A型 Rh+ 红细胞':20,'O型 Rh- 红细胞':4,'血小板':8,'急救药品':13}, online:true, dataType:'规划节点·库存仿真' },
  { orgId:'BC10', org:'崇明应急供血前置点（规划）', type:'血站', address:'崇明城桥规划医疗节点', coordinates:[121.4056,31.6201], items:{'A型 Rh+ 红细胞':18,'O型 Rh- 红细胞':4,'血小板':7,'急救药品':12}, online:true, dataType:'规划节点·库存仿真' },
  { orgId:'BC11', org:'临港应急供血前置点（规划）', type:'血站', address:'南汇新城规划医疗节点', coordinates:[121.9128,30.8951], items:{'A型 Rh+ 红细胞':23,'O型 Rh- 红细胞':6,'血小板':9,'急救药品':17}, online:true, dataType:'规划节点·库存仿真' },
]
officialBloodNodes.forEach(node=>{if(!inventory.value.some(x=>x.orgId===node.orgId))inventory.value.push(node)})
hospitals.forEach(h=>{if(!inventory.value.some(x=>x.orgId===h.id))inventory.value.push({orgId:h.id,org:h.name,type:'医院',coordinates:h.coordinates,items:{'A型 Rh+ 红细胞':0,'O型 Rh- 红细胞':0,'血小板':0,'急救药品':0},online:true})})
inventory.value.forEach((org,orgIndex)=>materialOptions.forEach((name,itemIndex)=>{
  if(org.items[name]===undefined)org.items[name]=org.type==='血站'?Math.max(3,32-((orgIndex*3+itemIndex*5)%27)):0
}))
const fleet = ref(JSON.parse(localStorage.getItem('medical-fleet-v3') || 'null') || drones.map((d,index)=>({
  ...d, baseId:stations[index%stations.length].id, baseName:stations[index%stations.length].name,
  coordinates:stations[index%stations.length].coordinates, range:18+index*2, health:index===6?'维护中':'正常', updatedAt:'刚刚'
})))
const tasks = ref(JSON.parse(localStorage.getItem('medical-tasks-v3') || '[]'))
const messages = ref(JSON.parse(localStorage.getItem('medical-messages-v3') || '[]'))
const applications = ref(JSON.parse(localStorage.getItem('medical-applications-v3') || '[]'))
const legacyDemoIds=new Set(Array.from({length:10},(_,i)=>`REG-${String(i+1).padStart(3,'0')}`))
const legacyDemoOrgIds=new Set(Array.from({length:10},(_,i)=>`HREG${String(i+1).padStart(3,'0')}`))
applications.value=applications.value.filter(item=>!legacyDemoIds.has(item.id))
inventory.value=inventory.value.filter(item=>!legacyDemoOrgIds.has(item.orgId))
localStorage.setItem('medical-applications-v3',JSON.stringify(applications.value))
localStorage.setItem('medical-inventory-v3',JSON.stringify(inventory.value))
applications.value.filter(a=>a.status==='审核通过').forEach((item,index)=>{
  item.orgId=item.orgId||`HREG${item.id.replace(/\D/g,'')||index+1}`
  item.coordinates=item.coordinates||[121.39+(index%5)*.012,31.19+(index%4)*.009]
  if(!inventory.value.some(x=>x.orgId===item.orgId))inventory.value.push({orgId:item.orgId,org:item.name,type:'医院',address:item.address,coordinates:item.coordinates,items:Object.fromEntries(materialOptions.map(name=>[name,0])),online:true,dataType:'审核接入机构·库存由机构维护'})
})

let map, chart, flightTimer, droneMarker, droneGroundMarker, rotateCleanup
let groundTimer
let messageHideTimer
let currentOrgFocused=false
let semanticMarkers=[]
const autoOpenedFlightTasks=new Set()
let windAnimation=0,windParticles=[],geoWindParticles=[]
let weatherRefreshTimer,windRestartTimer,lastWeatherGridKey=''
const syncChannel = typeof BroadcastChannel!=='undefined' ? new BroadcastChannel('air-medical-live-v3') : null
function postSync(extra={}){
  if(!syncChannel)return
  const plain=JSON.parse(JSON.stringify({tasks:tasks.value,messages:messages.value,inventory:inventory.value,fleet:fleet.value,telemetry:flightTelemetry.value,...extra}))
  syncChannel.postMessage(plain)
}

const activeOrg = computed(()=>{
  const hospital=hospitals.find(h=>h.id===loginOrg.value)
  if(hospital)return hospital
  const node=inventory.value.find(x=>x.orgId===loginOrg.value)
  return node?{id:node.orgId,name:node.org,coordinates:node.coordinates,address:node.type}:hospitals[0]
})
const activeTask = computed(()=>tasks.value.find(t=>t.id===selectedTaskId.value))
const visibleMessages = computed(()=>messages.value.filter(m=>(!m.role||m.role===role.value)&&(!m.targetOrg||m.targetOrg===loginOrg.value)))
const unread = computed(()=>visibleMessages.value.filter(m=>!m.read).length)
const supplyTodos = computed(()=>tasks.value.filter(t=>t.status==='等待供给确认'&&t.supplierId===loginOrg.value&&t.requesterId!==loginOrg.value))
const loadingTodos = computed(()=>tasks.value.filter(t=>t.status==='等待供给机构确认装货'&&t.supplierId===loginOrg.value))
const groundDispatchTodos = computed(()=>tasks.value.filter(t=>t.status==='等待供给机构派车'&&t.supplierId===loginOrg.value))
const pendingSupply = computed(()=>supplyTodos.value.length+loadingTodos.value.length+groundDispatchTodos.value.length)
const pendingDispatch = computed(()=>tasks.value.filter(t=>t.status==='等待调度受理'||t.status==='等待调度匹配供给方').length)
const pendingReview = computed(()=>applications.value.filter(a=>a.status==='待审核').length)
const networkHospitalCount = computed(()=>hospitals.length+inventory.value.filter(x=>x.type==='医院'&&!hospitals.some(h=>h.id===x.orgId)).length)
const visibleTasks = computed(()=>{
  if(role.value===ROLE.HOSPITAL) return tasks.value.filter(t=>t.requesterId===activeOrg.value.id || t.supplierId===activeOrg.value.id)
  return tasks.value
})
const activeTasks = computed(()=>visibleTasks.value.filter(t=>t.status!=='任务完成'))
const dispatchTaskCount = computed(()=>tasks.value.filter(t=>!['任务完成','供给方拒绝'].includes(t.status)).length)
const pendingReceiptCount = computed(()=>tasks.value.filter(t=>t.requesterId===loginOrg.value&&['等待需求医院签收','等待需求医院确认地面收货'].includes(t.status)).length)
const historyTasks = computed(()=>visibleTasks.value.filter(t=>t.status==='任务完成'))
const sortedInventory = computed(()=>[...inventory.value].sort((a,b)=>(b.orgId===loginOrg.value)-(a.orgId===loginOrg.value)))
const arrivalTask = computed(()=>tasks.value.find(t=>t.requesterId===loginOrg.value&&['等待需求医院签收','等待需求医院确认地面收货'].includes(t.status)))
const launchOrders = computed(()=>tasks.value.filter(t=>t.status==='已下发·等待运营中心放飞'))
const flyingTasks = computed(()=>tasks.value.filter(t=>['无人机调机中','前往供给点','等待供给机构确认装货','携带物资前往需求医院','携带联运物资前往需求医院','等待需求医院签收','已签收·无人机返航'].includes(t.status)))
const viewableFlyingTasks = computed(()=>flyingTasks.value.filter(t=>role.value===ROLE.DISPATCH||role.value===ROLE.OPERATOR||loginOrg.value===t.requesterId||loginOrg.value===t.supplierId))
const flyingTask = computed(()=>viewableFlyingTasks.value.find(t=>t.id===selectedTaskId.value)||viewableFlyingTasks.value[0])
const telemetryTask = computed(()=>tasks.value.find(t=>t.id===flightTelemetry.value.taskId))
const monitorTelemetry = computed(()=>activeTask.value?.telemetry||flightTelemetry.value)
const canViewFlight = computed(()=>{
  const t=activeTask.value?.telemetry?activeTask.value:telemetryTask.value
  const telemetry=t?.telemetry||flightTelemetry.value
  if(!t||telemetry.longitude==null)return false
  return role.value===ROLE.DISPATCH||role.value===ROLE.OPERATOR||loginOrg.value===t.requesterId||loginOrg.value===t.supplierId
})
const transportAssessment = computed(()=>{
  if(!groundMinutes.value)return {recommend:'等待道路数据',saving:0,ratio:0,text:'请先获取地面交通数据后生成运输建议。'}
  if(weatherAssessment.value.level==='禁止放飞')return {recommend:'强制采用地面配送',saving:0,ratio:0,text:'低空气象条件超过安全阈值，无论低空方案预计用时多短，都不允许下发无人机任务。'}
  const saving=groundMinutes.value-airMinutes.value,ratio=Math.round(saving/groundMinutes.value*100)
  if(saving>=5)return {recommend:'推荐低空配送',saving,ratio,text:`低空方案预计节省${saving}分钟，时效提升${ratio}%，且当前安全绕行航线满足任务时限。`}
  if(saving<0)return {recommend:'推荐地面车辆配送',saving:Math.abs(saving),ratio:Math.round(Math.abs(saving)/airMinutes.value*100),text:`地面方案预计比无人机快${Math.abs(saving)}分钟，系统已默认选择地面车辆，并等待调度中心通知供给机构派车。`}
  return {recommend:'建议地面配送',saving,ratio,text:`两种方案时差仅${Math.abs(saving)}分钟，低空调度收益有限，建议优先使用地面运力。`}
})
const candidateSuppliers = computed(()=>{
  const task=activeTask.value
  if(!task) return []
  return inventory.value.map(org=>{
    const distance=turf.distance(turf.point(org.coordinates),turf.point(task.destination),{units:'kilometers'})
    const lines=task.lineItems?.length?task.lineItems:[{name:task.material,amount:task.amount}]
    const stock=Math.min(...lines.map(line=>org.items[line.name]||0))
    const eligible=org.orgId!==task.requesterId&&org.online&&lines.every(line=>(org.items[line.name]||0)>=line.amount)
    const score=eligible?Math.max(0,Math.round(100-Math.min(45,distance*5)+Math.min(25,stock*1.2))):0
    return {...org,distance,stock,eligible,score}
  }).sort((a,b)=>(b.eligible-a.eligible)||a.distance-b.distance)
})
const selectedSupplier = computed(()=>candidateSuppliers.value.find(s=>s.orgId===selectedSupplierId.value) || candidateSuppliers.value[0])
const batchPayload = computed(()=>{
  const ids=new Set([activeTask.value?.id,...selectedBatchTaskIds.value])
  const units=tasks.value.filter(t=>ids.has(t.id)).reduce((sum,t)=>sum+Math.max(1,(t.lineItems||[]).reduce((n,x)=>n+Number(x.amount||0),0)||Number(t.amount||1)),0)
  return Math.max(1,Number((units*.35).toFixed(1)))
})
const candidateDrones = computed(()=>{
  const supplier=selectedSupplier.value
  if(!supplier) return []
  return fleet.value.map(d=>{
    const reposition=turf.distance(turf.point(d.coordinates),turf.point(supplier.coordinates),{units:'kilometers'})
    const delivery=activeTask.value?turf.distance(turf.point(supplier.coordinates),turf.point(activeTask.value.destination),{units:'kilometers'}):0
    const reservation=tasks.value.find(t=>t.id!==activeTask.value?.id&&t.droneId===d.id&&!t.batchParentId&&!['任务完成','供给方拒绝','联运站点已签收'].includes(t.status))
    const shareSelected=reservation&&selectedBatchTaskIds.value.includes(reservation.id)&&['已下发·等待运营中心放飞','调度方案已确认·等待放飞'].includes(reservation.status)
    const available=d.status==='空闲'&&!reservation
    const eligible=(available||shareSelected)&&d.health==='正常'&&d.load>=batchPayload.value&&d.battery>=45&&d.range>=reposition+delivery
    return {...d,reposition,delivery,eligible,reservation,shareSelected,available}
  }).sort((a,b)=>(b.eligible-a.eligible)||(b.available-a.available)||a.reposition-b.reposition)
})
const selectedDrone = computed(()=>candidateDrones.value.find(d=>d.id===selectedDroneId.value)||null)
const coRouteCandidates = computed(()=>{
  const current=activeTask.value,supplier=selectedSupplier.value
  if(!current||!supplier)return []
  return tasks.value.filter(t=>t.id!==current.id&&['等待调度受理','调度分析中','等待供给确认','等待调度匹配供给方','已下发·等待运营中心放飞','调度方案已确认·等待放飞'].includes(t.status)&&!t.batchParentId).map(t=>{
    const direct=turf.distance(turf.point(supplier.coordinates),turf.point(t.destination),{units:'kilometers'})
    const connection=turf.distance(turf.point(current.destination),turf.point(t.destination),{units:'kilometers'})
    const detourRatio=Math.round(connection/Math.max(.1,direct)*100)
    const sameSupplier=t.supplierId===supplier.orgId
    const confirmed=['等待调度受理','调度分析中','已下发·等待运营中心放飞','调度方案已确认·等待放飞'].includes(t.status)
    const coldCompatible=current.cold===t.cold
    const compatible=sameSupplier&&confirmed&&coldCompatible&&detourRatio<=45&&current.deadline>=15&&t.deadline>=15
    const reason=!sameSupplier?'供给点不同':!confirmed?'尚未获得供给确认':!coldCompatible?'冷链条件不同':detourRatio>45?'绕行距离过大':(current.deadline<15||t.deadline<15)?'任务时限过紧':'满足联运条件'
    return {...t,connection,detourRatio,compatible,reason,reservedDroneId:t.droneId||''}
  }).sort((a,b)=>(b.compatible-a.compatible)||a.detourRatio-b.detourRatio)
})
const trafficPeriod = computed(()=>{
  const h=new Date().getHours()
  if(h>=7&&h<10)return {name:'早高峰',level:'拥堵',factor:1.65,color:'#ff5a55'}
  if(h>=17&&h<20)return {name:'晚高峰',level:'严重拥堵',factor:1.85,color:'#ff334f'}
  if(h>=22||h<6)return {name:'夜间低谷',level:'畅通',factor:.82,color:'#35d879'}
  if(h>=11&&h<14)return {name:'午间平峰',level:'缓行',factor:1.18,color:'#ffd047'}
  return {name:'日间平峰',level:'基本畅通',factor:1.05,color:'#57d990'}
})
const weatherAssessment = computed(()=>{
  const points=routeWeather.value.length?routeWeather.value:[weather.value]
  const maxWind=Math.max(...points.map(x=>Number(x.windSpeed||0))),maxGust=Math.max(...points.map(x=>Number(x.gust||0)))
  const maxRain=Math.max(...points.map(x=>Number(x.precipitation||0))),minVisibility=Math.min(...points.map(x=>Number(x.visibility||99)))
  if(maxWind>12||maxGust>16||maxRain>=7||minVisibility<2)return {level:'禁止放飞',className:'danger',text:`气象条件超过安全阈值：最大风速${maxWind.toFixed(1)}m/s、阵风${maxGust.toFixed(1)}m/s、降水${maxRain}mm、最低能见度${minVisibility.toFixed(1)}km，建议改为地面配送。`}
  if(maxWind>=8||maxGust>=12||maxRain>=2||minVisibility<5)return {level:'谨慎放飞',className:'warning',text:`存在中等气象风险：需降低速度、增加返航电量预留并持续监控航线天气。`}
  return {level:'适宜飞行',className:'safe',text:`航线三点天气满足当前演示阈值，最大风速${maxWind.toFixed(1)}m/s，最低能见度${minVisibility.toFixed(1)}km。`}
})
const displayedWind = computed(()=>windLevel.value==='surface'
  ?{label:'地表10米',speed:weather.value.groundWindSpeed??weather.value.windSpeed,direction:weather.value.groundWindDirection??weather.value.windDirection}
  :{label:'低空120米',speed:weather.value.windSpeed,direction:weather.value.windDirection})
const directAirLine = computed(()=>{
  if(!activeTask.value||!selectedSupplier.value) return null
  return turf.lineString([selectedSupplier.value.coordinates,activeTask.value.destination])
})
const routeSafetyBufferKm=.25
const hardRestrictions=()=>restrictions.map(zone=>turf.polygon(zone.coordinates))
const bufferedRestrictions=()=>restrictions
  .map(zone=>turf.buffer(turf.polygon(zone.coordinates),routeSafetyBufferKm,{units:'kilometers',steps:2}))
  .filter(Boolean)
const segmentDistance=(a,b)=>turf.distance(turf.point(a),turf.point(b),{units:'kilometers'})
const routeHasConflict=route=>!route||route.properties?.safe===false||
  hardRestrictions().some(zone=>turf.booleanIntersects(route,zone))
function buildSafeLeg(from,to){
  const hardObstacles=hardRestrictions()
  const obstacles=bufferedRestrictions()
  const clear=(a,b)=>{
    const line=turf.lineString([a,b])
    // 红色禁飞区是绝对硬约束，任何航段都不能相交。
    if(hardObstacles.some(polygon=>turf.booleanIntersects(line,polygon)))return false
    // 安全缓冲带用于优先避让；若医院本身位于缓冲带内，则允许从该端点向外离开。
    return !obstacles.some(polygon=>{
      if(!turf.booleanIntersects(line,polygon))return false
      const endpointInside=turf.booleanPointInPolygon(turf.point(a),polygon)||
        turf.booleanPointInPolygon(turf.point(b),polygon)
      return !endpointInside
    })
  }
  const directKm=segmentDistance(from,to)
  if(clear(from,to))return turf.lineString([from,to],{
    safe:true,blocked:false,distanceKm:directKm,directKm,detourKm:0,
    algorithm:'visibility-graph-a-star',safetyBufferKm:routeSafetyBufferKm
  })

  // 使用“扩大后的禁飞区边界顶点”建立可视图，候选点本身位于安全边界之外。
  const nodes=[from,to]
  obstacles.forEach(obstacle=>{
    const center=turf.centroid(obstacle)
    const polygons=obstacle.geometry.type==='MultiPolygon'
      ?obstacle.geometry.coordinates
      :[obstacle.geometry.coordinates]
    polygons.forEach(rings=>rings.forEach(ring=>ring.slice(0,-1).forEach(vertex=>{
      const bearing=turf.bearing(center,turf.point(vertex))
      const escaped=turf.destination(
        turf.point(vertex),
        .06,
        bearing,
        {units:'kilometers'}
      ).geometry.coordinates
      if(!obstacles.some(obstacle=>turf.booleanPointInPolygon(turf.point(escaped),obstacle)))nodes.push(escaped)
    })))
  })

  // 增加所有禁飞区外围的四个兜底节点。即使多个禁飞区相邻，也能从整体外侧绕行。
  if(obstacles.length){
    const obstacleCollection=turf.featureCollection(obstacles)
    const [west,south,east,north]=turf.bbox(obstacleCollection)
    const middleLatitude=(south+north)/2
    const latitudePadding=.8/111
    const longitudePadding=.8/(111*Math.max(.2,Math.cos(middleLatitude*Math.PI/180)))
    nodes.push(
      [west-longitudePadding,south-latitudePadding],
      [west-longitudePadding,north+latitudePadding],
      [east+longitudePadding,north+latitudePadding],
      [east+longitudePadding,south-latitudePadding]
    )
  }

  // 去除距离过近的重复节点，降低可视图的连边数量。
  const uniqueNodes=nodes.filter((node,index,list)=>list.findIndex(other=>segmentDistance(node,other)<.015)===index)
  const gScore=Array(uniqueNodes.length).fill(Infinity)
  const fScore=Array(uniqueNodes.length).fill(Infinity)
  const previous=Array(uniqueNodes.length).fill(-1)
  const open=new Set([0])
  gScore[0]=0
  fScore[0]=segmentDistance(uniqueNodes[0],uniqueNodes[1])

  // A*在所有互相可见的候选点之间寻找真实距离最短的安全路径。
  while(open.size){
    let current=[...open].reduce((best,index)=>fScore[index]<fScore[best]?index:best)
    if(current===1)break
    open.delete(current)
    for(let next=0;next<uniqueNodes.length;next++){
      if(next===current||!clear(uniqueNodes[current],uniqueNodes[next]))continue
      const candidate=gScore[current]+segmentDistance(uniqueNodes[current],uniqueNodes[next])
      if(candidate>=gScore[next])continue
      previous[next]=current
      gScore[next]=candidate
      fScore[next]=candidate+segmentDistance(uniqueNodes[next],uniqueNodes[1])
      open.add(next)
    }
  }
  if(previous[1]<0)return turf.lineString([from,to],{
    safe:false,blocked:true,distanceKm:directKm,directKm,
    algorithm:'visibility-graph-a-star',safetyBufferKm:routeSafetyBufferKm
  })
  const route=[];let cursor=1
  while(cursor>=0){route.unshift(uniqueNodes[cursor]);cursor=previous[cursor]}
  const safe=!route.slice(0,-1).some((point,index)=>!clear(point,route[index+1]))
  const distanceKm=route.slice(0,-1).reduce((sum,point,index)=>sum+segmentDistance(point,route[index+1]),0)
  return turf.lineString(route,{
    safe,blocked:!safe,distanceKm,directKm,detourKm:Math.max(0,distanceKm-directKm),
    algorithm:'visibility-graph-a-star',safetyBufferKm:routeSafetyBufferKm
  })
}
const directRouteBlocked = computed(()=>directAirLine.value?hardRestrictions().some(zone=>turf.booleanIntersects(directAirLine.value,zone)):false)
const safeAirLine = computed(()=>{
  if(!directAirLine.value)return null
  const [a,b]=[directAirLine.value.geometry.coordinates[0],directAirLine.value.geometry.coordinates.at(-1)]
  return buildSafeLeg(a,b)
})
const airLine = computed(()=>selectedRoute.value==='direct'?directAirLine.value:safeAirLine.value)
const routeIsSafe = computed(()=>selectedRoute.value!=='direct'&&!routeHasConflict(airLine.value))
const airKm=computed(()=>airLine.value?turf.length(airLine.value,{units:'kilometers'}):0)
const airMinutes=computed(()=>Math.max(4,Math.round(airKm.value/.72+3)))

function save(){
  localStorage.setItem('medical-tasks-v3',JSON.stringify(tasks.value))
  localStorage.setItem('medical-messages-v3',JSON.stringify(messages.value))
  localStorage.setItem('medical-inventory-v3',JSON.stringify(inventory.value))
  localStorage.setItem('medical-fleet-v3',JSON.stringify(fleet.value))
  localStorage.setItem('medical-telemetry-v3',JSON.stringify(flightTelemetry.value))
  refreshMarkerStates()
  if(map)updateLabelScale()
  postSync()
}
function toast(text){notice.value=text;setTimeout(()=>notice.value='',2800)}
function addMessage(title,text,targetRole,taskId,targetOrg=''){
  messages.value.unshift({id:`MSG-${Date.now()}`,title,text,role:targetRole,targetOrg,taskId,time:new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}),read:false})
  save()
  postSync({alert:{title,text,targetRole,targetOrg}})
}
function openMessage(message){
  message.read=true
  const task=tasks.value.find(t=>t.id===message.taskId)
  if(role.value===ROLE.DISPATCH&&task)openDispatch(task)
  else if(role.value===ROLE.OPERATOR)page.value=launchOrders.value.length?'fleet':'flight'
  else if(role.value===ROLE.HOSPITAL&&task?.supplierId===loginOrg.value&&task.status==='等待供给确认')page.value='supplyTodo'
  else page.value='tasks'
  save();showMessages.value=false
}
function login(){
  if(loginPassword.value!=='123456'){toast('统一演示密码为 123456');return}
  if(loginRole.value===ROLE.HOSPITAL&&!inventory.value.some(item=>item.orgId===loginOrg.value)){
    toast('请选择已审核接入的医疗机构');return
  }
  role.value=loginRole.value;isLoggedIn.value=true
  currentOrgFocused=false
  page.value=role.value===ROLE.DISPATCH?'overview':role.value===ROLE.OPERATOR?'fleet':'requests'
  nextTick(()=>initMap())
}
function submitRegistration(){
  registerMessage.value=''
  const name=registerForm.value.name.trim()
  const address=registerForm.value.address.trim()
  const contact=registerForm.value.contact.trim()
  if(!name||!address||!contact){registerMessage.value='请完整填写机构名称、详细地址和联系人';return}
  const duplicate=applications.value.some(item=>item.name===name&&['待审核','审核通过'].includes(item.status))
    ||inventory.value.some(item=>item.org===name)
  if(duplicate){registerMessage.value='该机构已提交申请或已经接入系统，请勿重复注册';return}
  const center=districtCenters[registerForm.value.district]||districtCenters['长宁区']
  const seed=[...name].reduce((sum,char)=>sum+char.charCodeAt(0),0)
  const coordinates=[center[0]+((seed%9)-4)*.0025,center[1]+((Math.floor(seed/9)%9)-4)*.002]
  const application={
    id:`REG-${Date.now()}`,
    name,
    type:'医院',
    district:registerForm.value.district,
    address:`上海市${registerForm.value.district}${address}`,
    contact,
    coordinates,
    status:'待审核',
    submittedAt:new Date().toLocaleString('zh-CN')
  }
  applications.value.unshift(application)
  localStorage.setItem('medical-applications-v3',JSON.stringify(applications.value))
  addMessage('新的机构注册申请',`${name}申请接入协同网络，请进行资质审核`,ROLE.DISPATCH)
  registerMessage.value='注册申请已提交。调度中心审核通过后，机构才会出现在登录列表、地图和共享库存中。'
  registerForm.value={name:'',type:'医院',district:'长宁区',address:'',contact:''}
}
function cancelInstitutionAccount(){
  if(role.value!==ROLE.HOSPITAL)return
  const org=inventory.value.find(item=>item.orgId===loginOrg.value)
  if(!org)return
  const unfinished=tasks.value.some(task=>task.status!=='任务完成'&&(task.requesterId===org.orgId||task.supplierId===org.orgId))
  if(unfinished){toast('该机构仍有未完成任务，请完成交接后再注销账号');return}
  if(!window.confirm(`确认注销“${org.org}”的系统账号？注销后将不能登录，历史任务记录仍会保留。`))return
  let record=applications.value.find(item=>item.orgId===org.orgId)
  if(!record){
    record={id:`CANCEL-${Date.now()}`,orgId:org.orgId,name:org.org,type:org.type,address:org.address,contact:'原系统机构',coordinates:org.coordinates,submittedAt:'系统既有机构'}
    applications.value.unshift(record)
  }
  record.status='已注销'
  record.cancelledAt=new Date().toLocaleString('zh-CN')
  inventory.value=inventory.value.filter(item=>item.orgId!==org.orgId)
  localStorage.setItem('medical-applications-v3',JSON.stringify(applications.value))
  save()
  logout()
}
function resetRequestDraft(){
  requestForm.value.selectedMaterials=[]
  requestForm.value.customMaterial=''
  requestForm.value.customAmount=1
  requestForm.value.customUnit='件'
  requestForm.value.preferredSupplier='AUTO'
}
function logout(){rotateCleanup?.();rotateCleanup=null;rotateMode.value=false;droneMarker?.remove();droneMarker=null;map?.remove();map=null;isLoggedIn.value=false;role.value='';resetRequestDraft()}
function resetDemoData(){
  if(!window.confirm('确认清除旧版本遗留的任务、消息、库存和飞行状态，并重新开始演示？'))return
  ;['medical-tasks-v3','medical-messages-v3','medical-inventory-v3','medical-fleet-v3','medical-telemetry-v3'].forEach(key=>localStorage.removeItem(key))
  window.location.reload()
}
function submitRequest(){
  const lineItems=requestForm.value.selectedMaterials.filter(x=>x.amount>0).map(x=>({...x}))
  if(requestForm.value.customMaterial.trim())lineItems.push({name:requestForm.value.customMaterial.trim(),amount:Math.max(1,requestForm.value.customAmount||1),unit:requestForm.value.customUnit||'件'})
  if(!lineItems.length){toast('请至少选择或填写一种医疗物资');return}
  const id=`MED-${new Date().toISOString().slice(5,10).replace('-','')}-${String(Date.now()).slice(-4)}`
  const preferred=requestForm.value.preferredSupplier
  const supplier=inventory.value.find(i=>i.orgId===preferred)
  const material=lineItems.map(x=>x.name).join('、')
  const amount=lineItems.reduce((sum,x)=>sum+x.amount,0)
  const task={id,requesterId:activeOrg.value.id,requester:activeOrg.value.name,destination:activeOrg.value.coordinates,
    material,amount,unit:'项',lineItems,deadline:requestForm.value.deadline,
    priority:requestForm.value.priority,cold:requestForm.value.cold,note:requestForm.value.note,
    supplierId:supplier?.orgId||'',supplier:supplier?.org||'',status:supplier?'等待供给确认':'等待调度匹配供给方',
    createdAt:new Date().toLocaleString('zh-CN'),timeline:[{name:'需求医院提交申请',time:new Date().toLocaleTimeString(),by:activeOrg.value.name}]}
  tasks.value.unshift(task);selectedTaskId.value=id
  addMessage('新的医疗物资申请',`${task.requester}申请${task.material} ${task.amount}${task.unit}`,supplier?ROLE.HOSPITAL:ROLE.DISPATCH,id,supplier?.orgId||'')
  save();page.value='tasks';toast('申请已提交，正在等待供给方或调度中心处理')
}
function toggleMaterial(name){
  const index=requestForm.value.selectedMaterials.findIndex(x=>x.name===name)
  if(index>=0)requestForm.value.selectedMaterials.splice(index,1)
  else requestForm.value.selectedMaterials.push({name,amount:1,unit:name.includes('红细胞')?'U':name.includes('血浆')?'ml':'治疗量'})
}
function selectedMaterial(name){return requestForm.value.selectedMaterials.find(x=>x.name===name)}
function supplierStockText(org){
  const lines=requestForm.value.selectedMaterials
  if(!lines.length)return '请选择物资'
  return lines.map(x=>`${x.name.replace('红细胞','红细胞')} ${org.items[x.name]||0}`).join('；')
}
function supplierDecision(task,accept){
  if(role.value!==ROLE.HOSPITAL || task.supplierId!==activeOrg.value.id || task.requesterId===activeOrg.value.id){
    toast('只有被申请的供给医院可以确认，本院不能替其他机构确认')
    return
  }
  if(!window.confirm(accept?`确认向${task.requester}提供${task.material} ${task.amount}${task.unit}？确认后调度中心才会收到任务。`:'确认拒绝本次物资申请？'))return
  if(!accept){task.status='供给方拒绝';task.timeline.push({name:'供给方拒绝分配',time:new Date().toLocaleTimeString(),by:role.value});addMessage('供给申请被拒绝',`${task.supplier||'供给机构'}无法提供本次物资`,ROLE.HOSPITAL,task.id)}
  else{task.status='等待调度受理';task.supplierConfirmedAt=new Date().toLocaleString('zh-CN');task.timeline.push({name:'供给医院确认物资',time:new Date().toLocaleTimeString(),by:task.supplier||role.value});addMessage('待调度任务',`${task.supplier}已确认向${task.requester}提供物资`,ROLE.DISPATCH,task.id);addMessage('供给医院已确认',`${task.supplier}已同意分配物资，等待调度`,ROLE.HOSPITAL,task.id,task.requesterId)}
  save();toast(accept?'已确认供给，调度中心已收到待办':'已拒绝并通知需求医院')
}
function openDispatch(task){
  if(!task)return
  selectedTaskId.value=task.id;selectedSupplierId.value=task.supplierId||'';selectedDroneId.value='';selectedBatchTaskIds.value=[];groundMinutes.value=null;groundDistance.value=null;deliveryMode.value='air';dispatchStep.value=task.status==='调度分析中'?2:1
  page.value='dispatch';messages.value.filter(m=>m.taskId===task.id&&m.role===ROLE.DISPATCH).forEach(m=>m.read=true);save()
  nextTick(()=>{updateMapData();focusTask()})
}
function openFlightMonitor(task){
  if(!task?.droneId){toast('该任务尚未分配无人机');return}
  selectedTaskId.value=task.id;page.value='flight';mapMode.value='3d';autoOpenedFlightTasks.add(task.id)
  nextTick(()=>{
    applyLayerVisibility();startWindAnimation()
    showPlannedRoute(task)
    const telemetry=task.telemetry
    if(telemetry?.longitude!=null){
      const drone=fleet.value.find(d=>d.id===task.droneId)
      if(drone)ensureFlightMarker(drone,[telemetry.longitude,telemetry.latitude])
      map.easeTo({center:[telemetry.longitude,telemetry.latitude],pitch:62,zoom:15.3,duration:700})
    }else focusTask()
  })
}
function openGroundMonitor(task){
  if(task?.deliveryMode!=='地面车辆'){toast('该任务不是地面配送任务');return}
  selectedTaskId.value=task.id;page.value='groundMonitor'
  nextTick(()=>{
    const supplier=inventory.value.find(x=>x.orgId===task.supplierId)
    if(supplier&&map){
      const bounds=new mapboxgl.LngLatBounds().extend(supplier.coordinates).extend(task.destination)
      map.fitBounds(bounds,{padding:110,maxZoom:14,duration:600})
    }
  })
}
function exitFlightMonitor(){
  followDrone.value=false
  page.value=role.value===ROLE.DISPATCH?'tasks':role.value===ROLE.OPERATOR?'fleet':'tasks'
  toast('已退出观看，无人机任务仍在后台继续执行')
}
function assignSupplier(){
  const t=activeTask.value,s=selectedSupplier.value
  if(!s?.eligible){toast('该机构库存不足或不在线');return}
  t.supplierId=s.orgId;t.supplier=s.org;t.status='等待供给确认';t.timeline.push({name:'调度中心推荐供给方，等待确认',time:new Date().toLocaleTimeString(),by:'调度中心'})
  addMessage('调度协助匹配申请',`${t.requester}需要${t.material}，是否同意提供？`,ROLE.HOSPITAL,t.id,s.orgId);save();toast('已向供给医院发送确认申请')
}
function acceptDispatch(){
  dispatchStep.value=2;activeTask.value.status='调度分析中';activeTask.value.timeline.push({name:'调度中心受理',time:new Date().toLocaleTimeString(),by:'调度中心'})
  selectedDroneId.value=''
  const empty=turf.featureCollection([]);map?.getSource('planned-flight')?.setData(empty);map?.getSource('air-route')?.setData(empty)
  save()
}
function chooseDrone(drone){
  if(!drone?.eligible)return
  selectedDroneId.value=drone.id
  nextTick(()=>showPlannedRoute(activeTask.value))
}
function confirmDrone(){
  const reservedPartner=coRouteCandidates.value.find(x=>selectedBatchTaskIds.value.includes(x.id)&&x.reservedDroneId)
  if(reservedPartner)selectedDroneId.value=reservedPartner.reservedDroneId
  const drone=candidateDrones.value.find(d=>d.id===selectedDroneId.value)||selectedDrone.value
  if(!drone?.eligible){toast(reservedPartner?'该联运无人机的载重、电量或航程不满足合并任务':'请选择满足条件且未被其他任务占用的无人机');return}
  selectedDroneId.value=drone.id;dispatchStep.value=3;refreshTraffic();analyzeRouteWeather();updateMapData();nextTick(()=>showPlannedRoute(activeTask.value))
}
function issueTask(){
  const t=activeTask.value
  if(!routeIsSafe.value){toast('当前航线仍与禁飞区冲突，禁止下发无人机任务');return}
  const dispatchDrone=selectedDrone.value,dispatchBase=stations.find(s=>s.id===dispatchDrone?.baseId)||stations[0]
  const plannedStops=[dispatchBase.coordinates,selectedSupplier.value.coordinates,t.destination,...coRouteCandidates.value.filter(x=>selectedBatchTaskIds.value.includes(x.id)).map(x=>x.destination)]
  const returnCandidates=stations
    .map(station=>({station,route:buildSafeLeg(plannedStops.at(-1),station.coordinates)}))
    .filter(item=>!routeHasConflict(item.route))
    .sort((a,b)=>a.route.properties.distanceKm-b.route.properties.distanceKm)
  if(!returnCandidates.length){toast('没有可安全抵达的返航基地，禁止下发');return}
  plannedStops.push(returnCandidates[0].station.coordinates)
  if(plannedStops.slice(0,-1).some((point,index)=>routeHasConflict(buildSafeLeg(point,plannedStops[index+1])))){
    toast('完整航线中存在穿越禁飞区的航段，已禁止下发')
    return
  }
  const reservedPartner=coRouteCandidates.value.find(x=>selectedBatchTaskIds.value.includes(x.id)&&x.droneId&&['已下发·等待运营中心放飞','调度方案已确认·等待放飞'].includes(x.status))
  if(reservedPartner){
    const root=reservedPartner.batchParentId?tasks.value.find(x=>x.id===reservedPartner.batchParentId):tasks.value.find(x=>x.id===reservedPartner.id)
    if(!root){toast('原联运任务不存在，请重新选择');return}
    t.droneId=root.droneId;t.baseId=root.baseId;t.batchParentId=root.id;t.status='联运批次·等待首站配送'
    root.batchTaskIds=[...new Set([...(root.batchTaskIds||[]),t.id])]
    const sharedText=`与任务 ${root.id} 一起使用 ${root.droneId} 顺路联运完成配送`
    t.timeline.push({name:sharedText,time:new Date().toLocaleTimeString(),by:'调度中心'})
    root.timeline.push({name:`任务 ${t.id} 已加入本次联运，共同使用 ${root.droneId}`,time:new Date().toLocaleTimeString(),by:'调度中心'})
    addMessage('任务已加入顺路联运',sharedText,ROLE.HOSPITAL,t.id,t.requesterId)
    addMessage('联运批次增加配送任务',`${root.droneId}将在起飞前合并执行 ${root.id} 与 ${t.id}`,ROLE.OPERATOR,root.id)
    dispatchStep.value=4;save();toast(sharedText);nextTick(()=>showPlannedRoute(root));return
  }
  t.droneId=selectedDrone.value.id;t.baseId=selectedDrone.value.baseId;t.status='已下发·等待运营中心放飞';t.timeline.push({name:'调度方案已下发，等待运营中心放飞',time:new Date().toLocaleTimeString(),by:'调度中心'})
  const batch=coRouteCandidates.value.filter(x=>selectedBatchTaskIds.value.includes(x.id))
  t.batchTaskIds=batch.map(x=>x.id)
  batch.forEach(x=>{const target=tasks.value.find(task=>task.id===x.id);target.droneId=t.droneId;target.batchParentId=t.id;target.status='联运批次·等待首站配送';target.manualCoordination=!x.compatible;target.timeline.push({name:`并入联运批次 ${t.id}${x.compatible?'':'（调度员人工协调）'}`,time:new Date().toLocaleTimeString(),by:'调度中心'})})
  dispatchStep.value=4;addMessage('调度方案已下发',`${t.droneId}等待运营中心放飞`,ROLE.HOSPITAL,t.id,t.requesterId);addMessage('供给任务已进入运输准备',`${t.droneId}将前往本机构取货`,ROLE.HOSPITAL,t.id,t.supplierId);addMessage('新的待放飞指令',`${t.droneId}执行${t.id}，请完成放飞检查`,ROLE.OPERATOR,t.id);save()
  nextTick(()=>showPlannedRoute(t))
}
function issueGroundTask(){
  const task=activeTask.value
  if(!task||!groundMinutes.value){toast('请先获取地面交通数据');return}
  task.deliveryMode='地面车辆'
  task.status='等待供给机构派车'
  task.groundEta=groundMinutes.value
  task.timeline.push({name:'调度中心采用地面车辆配送方案',time:new Date().toLocaleTimeString(),by:'调度中心'})
  addMessage('地面配送派车指令',`${task.id}采用地面配送，请安排车辆送往${task.requester}`,ROLE.HOSPITAL,task.id,task.supplierId)
  addMessage('已采用地面配送',`${task.supplier}将安排车辆，预计${groundMinutes.value}分钟`,ROLE.HOSPITAL,task.id,task.requesterId)
  save();page.value='tasks';toast('地面配送方案已下发，等待供给机构派车')
}
function dispatchGroundVehicle(task){
  if(role.value!==ROLE.HOSPITAL||loginOrg.value!==task.supplierId||task.status!=='等待供给机构派车')return
  task.status='地面车辆配送中';task.groundProgress=0;task.groundStage='车辆已出发';task.vehicle='沪A·MED01'
  task.timeline.push({name:'供给机构确认车辆出发',time:new Date().toLocaleTimeString(),by:task.supplier})
  addMessage('地面车辆已出发',`${task.vehicle}正在前往${task.requester}`,ROLE.DISPATCH,task.id)
  clearInterval(groundTimer);groundTimer=setInterval(()=>{
    task.groundProgress=Math.min(100,(task.groundProgress||0)+5)
    task.groundStage=task.groundProgress<35?'前往需求医院':task.groundProgress<80?'运输途中':task.groundProgress<100?'即将抵达':'已抵达'
    if(task.groundProgress>=100){
      clearInterval(groundTimer);task.status='等待需求医院确认地面收货'
      task.timeline.push({name:'地面车辆抵达需求医院',time:new Date().toLocaleTimeString(),by:task.vehicle})
      addMessage('地面物资已抵达',`${task.vehicle}已抵达，请确认收货`,ROLE.HOSPITAL,task.id,task.requesterId)
    }
    save()
  },500)
  save();toast(`${task.vehicle}已出发`)
}
function signGroundTask(task){
  if(role.value!==ROLE.HOSPITAL||loginOrg.value!==task.requesterId||task.status!=='等待需求医院确认地面收货')return
  task.status='任务完成';task.groundStage='已签收归档';task.timeline.push({name:'需求医院确认地面收货',time:new Date().toLocaleTimeString(),by:task.requester})
  addMessage('地面配送任务完成',`${task.id}已完成签收`,ROLE.DISPATCH,task.id);save();toast('收货完成，任务已归档')
}
function authorizeLaunch(task){
  if(role.value!==ROLE.OPERATOR||task.status!=='已下发·等待运营中心放飞')return
  selectedTaskId.value=task.id;selectedSupplierId.value=task.supplierId;selectedDroneId.value=task.droneId
  task.status='无人机调机中';task.timeline.push({name:'运营中心完成检查并确认放飞',time:new Date().toLocaleTimeString(),by:'无人机运营中心'})
  save();nextTick(()=>{updateMapData();showPlannedRoute(task);startFlight()});toast(`${task.droneId}已放飞，任务将在后台执行；可点击“查看飞行状态”进入监控`)
}
function replayFlight(){
  const task=telemetryTask.value||flyingTask.value
  if(!task){toast('当前没有可以播放的飞行任务');return}
  selectedTaskId.value=task.id;selectedSupplierId.value=task.supplierId;selectedDroneId.value=task.droneId
  task.status='无人机调机中'
  nextTick(()=>{updateMapData();focusTask();startFlight()})
}
function signTask(task){
  if(role.value!==ROLE.HOSPITAL||task.requesterId!==activeOrg.value.id||task.status!=='等待需求医院签收'){toast('只有需求医院在物资抵达后可以签收');return}
  task.timeline.push({name:'需求医院签收',time:new Date().toLocaleTimeString(),by:activeOrg.value.name})
  const root=task.batchParentId?tasks.value.find(t=>t.id===task.batchParentId):task
  const remaining=(root?.batchTaskIds||[]).map(id=>tasks.value.find(t=>t.id===id)).find(t=>t&&!['任务完成','联运站点已签收'].includes(t.status)&&t.id!==task.id)
  if(remaining){
    task.status='联运站点已签收';remaining.droneId=task.droneId;remaining.status='携带物资前往需求医院'
    addMessage('联运首站已签收',`${task.requester}完成签收，无人机继续前往${remaining.requester}`,ROLE.DISPATCH,task.id)
    save();toast(`签收完成，无人机继续配送至${remaining.requester}`)
    flyLeg(remaining,task.destination,remaining.destination,'携带联运物资前往需求医院',(d)=>{
      remaining.status='等待需求医院签收';d.status='需求医院等待签收';d.coordinates=remaining.destination
      flightTelemetry.value={...flightTelemetry.value,stage:'联运下一站已抵达·等待签收',progress:100,altitude:0,speed:0,eta:'已抵达'}
      remaining.timeline.push({name:'联运无人机抵达，等待收货',time:new Date().toLocaleTimeString(),by:d.id})
      addMessage('联运物资已抵达',`${d.id}已抵达，请确认收货`,ROLE.HOSPITAL,remaining.id,remaining.requesterId);save()
    })
    return
  }
  task.status='已签收·无人机返航';addMessage('物资已签收',`${task.requester}完成签收，无人机开始返航`,ROLE.DISPATCH,task.id);save();toast('签收完成，无人机将前往最近保障基地')
  startReturnFlight(task)
}
function updateFleet(drone,field,value){drone[field]=value;drone.updatedAt=new Date().toLocaleTimeString();save();toast(`${drone.id}状态已更新`)}
function addDrone(){
  const id=newDrone.value.id.trim().toUpperCase()
  if(!id||fleet.value.some(d=>d.id===id)){toast('请输入不重复的无人机编号');return}
  const base=stations.find(s=>s.id===newDrone.value.baseId)||stations[0]
  fleet.value.push({id,load:Number(newDrone.value.load),battery:Number(newDrone.value.battery),range:Number(newDrone.value.range),cold:newDrone.value.cold,status:'空闲',health:'正常',baseId:base.id,baseName:base.name,coordinates:base.coordinates,updatedAt:'刚刚'})
  newDrone.value={id:'',load:5,battery:100,range:25,cold:true,baseId:stations[0].id};save();toast(`${id}已加入无人机资产库`)
}
function removeDrone(drone){
  if(drone.status!=='空闲'){toast('执行中无人机不能删除');return}
  fleet.value=fleet.value.filter(d=>d.id!==drone.id);save();toast(`${drone.id}已从资产库移除`)
}
function updateDroneBase(drone,baseId){const base=stations.find(s=>s.id===baseId);if(!base)return;drone.baseId=base.id;drone.baseName=base.name;drone.coordinates=base.coordinates;drone.updatedAt=new Date().toLocaleTimeString();save();toast(`${drone.id}已调整至${base.name}`)}
function changeStock(org,item,delta){org.items[item]=Math.max(0,(org.items[item]||0)+delta);save();toast(`${org.org}的${item}库存已更新`)}
function reviewInstitution(item,accepted){
  item.status=accepted?'审核通过':'已驳回'
  if(accepted){
    item.approvedAt=new Date().toLocaleString('zh-CN')
    item.orgId=item.orgId||`HREG${item.id.replace(/\D/g,'')||Date.now().toString().slice(-4)}`
    item.coordinates=item.coordinates||[121.39+(applications.value.indexOf(item)%5)*.012,31.19+(applications.value.indexOf(item)%4)*.009]
    if(!inventory.value.some(x=>x.orgId===item.orgId)){
      inventory.value.push({orgId:item.orgId,org:item.name,type:'医院',address:item.address,coordinates:item.coordinates,items:Object.fromEntries(materialOptions.map(name=>[name,0])),online:true,dataType:'审核接入机构·库存由机构维护'})
    }
    addMessage('机构接入完成',`${item.name}已进入地图、共享库存和任务协同网络`,ROLE.DISPATCH)
    if(map?.isStyleLoaded()){
      const data=sourceData()
      map.getSource('hospitals')?.setData(data.hospitals)
      map.getSource('supply')?.setData(data.supply)
      addSemanticMarkers()
      map.flyTo({center:item.coordinates,zoom:12.4,pitch:0,bearing:0,duration:1200})
    }
  }
  localStorage.setItem('medical-applications-v3',JSON.stringify(applications.value));save();toast(`${item.name}：${item.status}`)
}
function focusInstitution(item){
  if(!map||!item.coordinates)return
  map.flyTo({center:item.coordinates,zoom:13,pitch:0,bearing:0,duration:1100})
  setTimeout(()=>{
    const marker=semanticMarkers.find(entry=>entry.getElement()?.dataset?.orgId===item.orgId)
    marker?.getElement()?.click()
  },1200)
}

function sourceData(){
  return {
    hospitals:turf.featureCollection([...hospitals,...inventory.value.filter(x=>x.type==='医院'&&!hospitals.some(h=>h.id===x.orgId)).map(x=>({id:x.orgId,name:x.org,address:x.address,coordinates:x.coordinates}))].map(h=>turf.point(h.coordinates,{...h,kind:'hospital'}))),
    supply:turf.featureCollection(inventory.value.map(s=>turf.point(s.coordinates,{...s,kind:'supply'}))),
    bases:turf.featureCollection(stations.map(s=>turf.point(s.coordinates,{...s,kind:'base'}))),
    restrictions:turf.featureCollection(restrictions.map(r=>turf.polygon(r.coordinates,r))),
    coverage:turf.featureCollection(stations.map(s=>turf.circle(s.coordinates,s.radius,{units:'kilometers',properties:{name:s.name,radius:s.radius,dataType:'仿真建议服务范围'}}))),
  }
}
function addSource(id,data){if(map.getSource(id))map.getSource(id).setData(data);else map.addSource(id,{type:'geojson',data})}
async function fetchWeatherAt(points){
  const latitude=points.map(p=>p[1]).join(','),longitude=points.map(p=>p[0]).join(',')
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=visibility,wind_speed_120m,wind_direction_120m&forecast_hours=1&wind_speed_unit=ms&timezone=Asia%2FShanghai`
  const response=await fetch(url);if(!response.ok)throw Error(`天气接口 ${response.status}`)
  const raw=await response.json(),list=Array.isArray(raw)?raw:[raw]
  return list.map((x,index)=>({name:['供给点','航线中点','需求医院'][index]||`点位${index+1}`,coordinates:points[index],temperature:x.current?.temperature_2m,windSpeed:x.hourly?.wind_speed_120m?.[0]??x.current?.wind_speed_10m,windDirection:x.hourly?.wind_direction_120m?.[0]??x.current?.wind_direction_10m,groundWindSpeed:x.current?.wind_speed_10m,groundWindDirection:x.current?.wind_direction_10m,gust:x.current?.wind_gusts_10m,precipitation:x.current?.precipitation||0,visibility:(x.hourly?.visibility?.[0]||10000)/1000,code:x.current?.weather_code,source:'Open-Meteo预报',updatedAt:new Date().toLocaleTimeString()}))
}
async function refreshWeather(){
  weatherLoading.value=true
  try{
    let west=121.15,east=121.75,south=30.95,north=31.55
    if(map&&map.getZoom()>=8.8){
      const bounds=map.getBounds()
      west=Math.max(121.0,bounds.getWest());east=Math.min(121.9,bounds.getEast())
      south=Math.max(30.7,bounds.getSouth());north=Math.min(31.7,bounds.getNorth())
    }
    if(east<=west||north<=south)throw Error('当前视窗不在上海天气范围')
    const gridPoints=[]
    for(let row=0;row<5;row++)for(let col=0;col<5;col++)gridPoints.push([
      Number((west+(east-west)*col/4).toFixed(4)),
      Number((south+(north-south)*row/4).toFixed(4))
    ])
    const result=await fetchWeatherAt(gridPoints)
    weatherGrid.value=result
    const center=map?[map.getCenter().lng,map.getCenter().lat]:[121.4737,31.2304]
    weather.value=[...result].sort((a,b)=>turf.distance(turf.point(a.coordinates),turf.point(center))-turf.distance(turf.point(b.coordinates),turf.point(center)))[0]
    weather.value={...weather.value,source:`Open-Meteo 当前视窗网格（${result.length}点）`}
    drawWindLayer()
  }catch(e){
    weatherGrid.value=[]
    weather.value={...weather.value,source:'仿真备用',updatedAt:new Date().toLocaleTimeString()}
    drawWindLayer()
  }finally{weatherLoading.value=false}
}
function scheduleViewWeather(){
  clearTimeout(weatherRefreshTimer)
  if(!map||!windCanvasVisible.value)return
  const b=map.getBounds(),key=[map.getZoom().toFixed(1),b.getWest().toFixed(2),b.getSouth().toFixed(2),b.getEast().toFixed(2),b.getNorth().toFixed(2)].join('|')
  if(key===lastWeatherGridKey)return
  weatherRefreshTimer=setTimeout(()=>{lastWeatherGridKey=key;refreshWeather()},650)
}
async function analyzeRouteWeather(){
  if(!activeTask.value||!selectedSupplier.value)return
  const a=selectedSupplier.value.coordinates,b=activeTask.value.destination,mid=[(a[0]+b[0])/2,(a[1]+b[1])/2]
  weatherLoading.value=true
  try{routeWeather.value=await fetchWeatherAt([a,mid,b])}
  catch(e){routeWeather.value=[{...weather.value,name:'供给点',coordinates:a},{...weather.value,name:'航线中点',coordinates:mid},{...weather.value,name:'需求医院',coordinates:b}]}
  finally{weatherLoading.value=false}
}
function drawWindLayer(){
  if(!map?.isStyleLoaded())return
  const samples=weatherGrid.value.length?weatherGrid.value:[weather.value]
  const features=samples.filter(s=>s.coordinates).map(s=>{
    const direction=windLevel.value==='surface'?(s.groundWindDirection??s.windDirection):s.windDirection
    const speed=windLevel.value==='surface'?(s.groundWindSpeed??s.windSpeed):s.windSpeed
    const flowBearing=((direction||90)+180)%360
    const start=turf.point(s.coordinates),end=turf.destination(start,1.4,flowBearing,{units:'kilometers'})
    return turf.lineString([start.geometry.coordinates,end.geometry.coordinates],{speed,direction})
  })
  addSource('weather-wind',turf.featureCollection(features))
  if(!map.getLayer('weather-wind'))map.addLayer({id:'weather-wind',type:'line',source:'weather-wind',minzoom:9,maxzoom:14,paint:{'line-color':['interpolate',['linear'],['get','speed'],0,'#50d9ff',8,'#ffd44c',12,'#ff4b65'],'line-width':2,'line-opacity':.55}})
  applyLayerVisibility()
  startWindAnimation()
}
function setWindLevel(level){windLevel.value=level;drawWindLayer()}
function startWindAnimation(){
  cancelAnimationFrame(windAnimation)
  windAnimation=0
  if(!windCanvasVisible.value)return
  if(mapMode.value==='2d')startGeoCanvasWindAnimation()
  else startGroundWindAnimation()
}

function restartWindForSettledView(){
  clearTimeout(windRestartTimer)
  updateWindVisibility()
  if(!windCanvasVisible.value)return
  requestAnimationFrame(startWindAnimation)
  windRestartTimer=setTimeout(()=>{
    updateWindVisibility()
    if(windCanvasVisible.value)startWindAnimation()
  },180)
}

function windVectorAt(coordinates){
  const samples=(weatherGrid.value.length?weatherGrid.value:[weather.value]).filter(Boolean)
  let east=0,north=0,totalWeight=0
  samples.forEach(sample=>{
    const sampleCoordinates=sample.coordinates||[map.getCenter().lng,map.getCenter().lat]
    const dx=(coordinates[0]-sampleCoordinates[0])*Math.cos(coordinates[1]*Math.PI/180)
    const dy=coordinates[1]-sampleCoordinates[1]
    const distanceSquared=dx*dx+dy*dy
    const weight=1/Math.pow(distanceSquared+.000006,1.15)
    const direction=windLevel.value==='surface'
      ?(sample.groundWindDirection??sample.windDirection)
      :sample.windDirection
    const speed=Number(windLevel.value==='surface'
      ?(sample.groundWindSpeed??sample.windSpeed)
      :sample.windSpeed)||0
    const flowBearing=((Number(direction)||0)+180)%360*Math.PI/180
    east+=Math.sin(flowBearing)*speed*weight
    north+=Math.cos(flowBearing)*speed*weight
    totalWeight+=weight
  })
  if(!totalWeight)return {east:0,north:1,speed:1}
  east/=totalWeight
  north/=totalWeight
  return {east,north,speed:Math.hypot(east,north)}
}

function randomWindPoint(){
  const canvas=map.getCanvas()
  const width=Math.max(1,canvas.clientWidth)
  const height=Math.max(1,canvas.clientHeight)
  const point=map.unproject([
    4+Math.random()*Math.max(1,width-8),
    4+Math.random()*Math.max(1,height-8)
  ])
  return [point.lng,point.lat]
}

function screenWindPoint(index,count){
  const canvas=map.getCanvas()
  const width=Math.max(1,canvas.clientWidth)
  const height=Math.max(1,canvas.clientHeight)
  const columns=Math.max(1,Math.ceil(Math.sqrt(count*width/height)))
  const rows=Math.max(1,Math.ceil(count/columns))
  const column=index%columns
  const row=Math.floor(index/columns)
  const jitterX=(Math.random()-.5)*.46
  const jitterY=(Math.random()-.5)*.46
  const point=map.unproject([
    Math.max(4,Math.min(width-4,(column+.5+jitterX)*width/columns)),
    Math.max(4,Math.min(height-4,(row+.5+jitterY)*height/rows))
  ])
  return [point.lng,point.lat]
}

function windPointInOverscan(coordinates,margin=180){
  const canvas=map.getCanvas()
  const point=map.project(coordinates)
  return Number.isFinite(point.x)&&Number.isFinite(point.y)&&
    point.x>=-margin&&point.x<=canvas.clientWidth+margin&&
    point.y>=-margin&&point.y<=canvas.clientHeight+margin
}

function nextWindCoordinate(coordinates,particle){
  const target=windVectorAt(coordinates)
  if(!Number.isFinite(particle.flowEast)){
    particle.flowEast=target.east
    particle.flowNorth=target.north
  }else{
    // 给风向增加惯性，使流线经过相邻气象网格时自然弯曲而不是折线转向。
    particle.flowEast=particle.flowEast*.84+target.east*.16
    particle.flowNorth=particle.flowNorth*.84+target.north*.16
  }
  const speed=Math.hypot(particle.flowEast,particle.flowNorth)
  const magnitude=Math.max(.001,speed)
  const east=particle.flowEast/magnitude
  const north=particle.flowNorth/magnitude
  const latitude=map.getCenter().lat
  const kilometersPerPixel=156.543*Math.cos(latitude*Math.PI/180)/Math.pow(2,map.getZoom())
  const step=Math.max(.0006,kilometersPerPixel*Math.max(.7,Math.min(2.4,(speed||2)/3.6)))
  return {
    coordinates:[
      coordinates[0]+east*step/(111*Math.max(.3,Math.cos(coordinates[1]*Math.PI/180))),
      coordinates[1]+north*step/111
    ],
    speed:Number(speed||0)
  }
}

function startGeoCanvasWindAnimation(){
  const canvas=windCanvas.value,host=canvas?.parentElement
  if(!map||!canvas||!host)return
  const rect=map.getCanvas().getBoundingClientRect(),ratio=Math.min(2,window.devicePixelRatio||1)
  canvas.width=Math.round(rect.width*ratio)
  canvas.height=Math.round(rect.height*ratio)
  canvas.style.width=`${rect.width}px`
  canvas.style.height=`${rect.height}px`
  const ctx=canvas.getContext('2d')
  ctx.setTransform(ratio,0,0,ratio,0,0)
  ctx.lineWidth=1.65
  ctx.lineCap='round'
  const particleCount=Math.max(180,Math.round(rect.width*rect.height/3400))
  windParticles=Array.from({length:particleCount},(_,index)=>({
    coordinates:screenWindPoint(index,particleCount),
    age:Math.random()*40,
    max:100+Math.random()*90
  }))
  let cameraKey='',last=0
  const resetParticle=particle=>{
    particle.coordinates=randomWindPoint()
    particle.age=0
    particle.max=80+Math.random()*90
    particle.flowEast=undefined
    particle.flowNorth=undefined
  }
  const tick=time=>{
    if(mapMode.value!=='2d'||!windCanvasVisible.value){
      ctx.clearRect(0,0,rect.width,rect.height)
      windAnimation=0
      return
    }
    if(time-last<28){windAnimation=requestAnimationFrame(tick);return}
    last=time
    const nextCameraKey=[
      map.getCenter().lng.toFixed(4),map.getCenter().lat.toFixed(4),
      map.getZoom().toFixed(2),map.getBearing().toFixed(1)
    ].join('|')
    if(nextCameraKey!==cameraKey){
      cameraKey=nextCameraKey
      ctx.clearRect(0,0,rect.width,rect.height)
      windParticles.forEach((particle,index)=>{
        resetParticle(particle)
        particle.coordinates=screenWindPoint(index,windParticles.length)
      })
      windAnimation=requestAnimationFrame(tick)
      return
    }
    // 仅衰减已有透明像素，不再用深色矩形覆盖地图。
    ctx.globalCompositeOperation='destination-in'
    ctx.fillStyle='rgba(0,0,0,.91)'
    ctx.fillRect(0,0,rect.width,rect.height)
    ctx.globalCompositeOperation='source-over'
    windParticles.forEach(particle=>{
      if(particle.age>particle.max||!windPointInOverscan(particle.coordinates,12)){
        resetParticle(particle)
        return
      }
      const next=nextWindCoordinate(particle.coordinates,particle)
      if(!windPointInOverscan(next.coordinates,12)){
        resetParticle(particle)
        return
      }
      const from=map.project(particle.coordinates),to=map.project(next.coordinates)
      const jump=Math.hypot(to.x-from.x,to.y-from.y)
      if(!Number.isFinite(jump)||jump>18){
        resetParticle(particle)
        return
      }
      const lightBasemap=basemap.value==='streets'||basemap.value==='light'
      const color=next.speed>=12
        ?(lightBasemap?'202,28,64':'255,64,92')
        :next.speed>=8
          ?(lightBasemap?'211,118,0':'255,203,68')
          :(lightBasemap?'0,84,190':'76,226,244')
      ctx.strokeStyle=`rgba(${color},${lightBasemap ? .9 : .7})`
      ctx.beginPath()
      ctx.moveTo(from.x,from.y)
      ctx.lineTo(to.x,to.y)
      ctx.stroke()
      particle.coordinates=next.coordinates
      particle.age++
    })
    windAnimation=requestAnimationFrame(tick)
  }
  windAnimation=requestAnimationFrame(tick)
}

function startGroundWindAnimation(){
  if(!map)return
  if(!map.isStyleLoaded()){
    map.once('idle',()=>mapMode.value==='3d'&&startWindAnimation())
    return
  }
  const canvas=map.getCanvas()
  const lightBasemap=basemap.value==='streets'||basemap.value==='light'
  const windColor=lightBasemap?'#0060c7':'#4ce2f4'
  const particleCount=Math.max(180,Math.round(canvas.clientWidth*canvas.clientHeight/3400))
  geoWindParticles=Array.from({length:particleCount},(_,index)=>{
    const coordinates=screenWindPoint(index,particleCount)
    return {coordinates,trail:[coordinates],age:Math.random()*70,max:75+Math.random()*90}
  })
  if(map.getSource('weather-wind-3d'))map.getSource('weather-wind-3d').setData(turf.featureCollection([]))
  else map.addSource('weather-wind-3d',{type:'geojson',lineMetrics:true,data:turf.featureCollection([])})
  if(!map.getLayer('weather-wind-3d-glow')){
    map.addLayer({
      id:'weather-wind-3d-glow',type:'line',source:'weather-wind-3d',minzoom:9,maxzoom:20,
      layout:{'line-cap':'round','line-join':'round'},
      paint:{'line-width':5.2,'line-color':windColor,'line-opacity':lightBasemap ? .4 : .3,'line-blur':2.2}
    })
  }
  if(!map.getLayer('weather-wind-3d')){
    map.addLayer({
      id:'weather-wind-3d',type:'line',source:'weather-wind-3d',minzoom:9,maxzoom:20,
      layout:{'line-cap':'round','line-join':'round'},
      paint:{
        'line-width':1.65,
        'line-emissive-strength':1,
        'line-gradient':['interpolate',['linear'],['line-progress'],
          0,lightBasemap?'rgba(0,96,199,0)':'rgba(76,226,244,0)',
          .42,lightBasemap?'rgba(0,96,199,.2)':'rgba(76,226,244,.12)',
          .82,lightBasemap?'rgba(0,96,199,.62)':'rgba(76,226,244,.46)',
          1,lightBasemap?'rgba(0,72,165,.95)':'rgba(76,226,244,.78)']
      }
    })
  }
  let last=0,cameraKey=''
  const resetParticle=particle=>{
    particle.coordinates=randomWindPoint()
    particle.trail=[particle.coordinates]
    particle.age=0
    particle.max=75+Math.random()*90
    particle.flowEast=undefined
    particle.flowNorth=undefined
  }
  const tick=time=>{
    if(mapMode.value!=='3d'||!windCanvasVisible.value){
      map.getSource('weather-wind-3d')?.setData(turf.featureCollection([]))
      windAnimation=0
      return
    }
    if(time-last<28){windAnimation=requestAnimationFrame(tick);return}
    last=time
    const nextCameraKey=[
      map.getCenter().lng.toFixed(4),map.getCenter().lat.toFixed(4),
      map.getZoom().toFixed(2),map.getBearing().toFixed(1),map.getPitch().toFixed(1)
    ].join('|')
    if(nextCameraKey!==cameraKey){
      cameraKey=nextCameraKey
      geoWindParticles.forEach((particle,index)=>{
        resetParticle(particle)
        particle.coordinates=screenWindPoint(index,geoWindParticles.length)
        particle.trail=[particle.coordinates]
      })
      map.getSource('weather-wind-3d')?.setData(turf.featureCollection([]))
      windAnimation=requestAnimationFrame(tick)
      return
    }
    const features=[]
    geoWindParticles.forEach(particle=>{
      if(particle.age>particle.max||!windPointInOverscan(particle.coordinates)){
        resetParticle(particle)
        return
      }
      const next=nextWindCoordinate(particle.coordinates,particle)
      const segmentKm=turf.distance(turf.point(particle.coordinates),turf.point(next.coordinates),{units:'kilometers'})
      if(!windPointInOverscan(next.coordinates)||!Number.isFinite(segmentKm)||segmentKm>.45){
        resetParticle(particle)
        return
      }
      particle.coordinates=next.coordinates
      particle.trail.push(next.coordinates)
      if(particle.trail.length>14)particle.trail.shift()
      particle.age++
      if(particle.trail.length>1)features.push(turf.lineString([...particle.trail],{speed:next.speed}))
    })
    map.getSource('weather-wind-3d')?.setData(turf.featureCollection(features))
    windAnimation=requestAnimationFrame(tick)
  }
  applyLayerVisibility()
  windAnimation=requestAnimationFrame(tick)
}



function initMap(){
  if(map){map.resize();return}
  map=new mapboxgl.Map({container:'map',style:basemapOptions[basemap.value]?.style||basemapOptions.dark.style,center:[121.47,31.18],zoom:9.45,pitch:0,bearing:0,antialias:true,attributionControl:false,dragRotate:true})
  map.dragRotate.enable();map.dragRotate.enablePitch()
  map.addControl(new mapboxgl.NavigationControl({showCompass:true,visualizePitch:true}),'bottom-right')
  map.on('move',()=>{mapBearing.value=Math.round(map.getBearing());mapPitch.value=Math.round(map.getPitch());mapZoom.value=map.getZoom().toFixed(1);updateWindVisibility()})
  map.on('resize',restartWindForSettledView)
  // map.on('moveend',()=>{
  //   const nextMode=map.getPitch()>8?'3d':'2d',modeChanged=nextMode!==mapMode.value
  //   mapMode.value=nextMode;applyLayerVisibility();scheduleViewWeather()
  //   if(modeChanged||nextMode==='3d')nextTick(startWindAnimation)
  // })
  map.on('moveend', () => {
    const nextMode = map.getPitch() > 8 ? '3d' : '2d'
    const modeChanged = nextMode !== mapMode.value
    mapMode.value = nextMode
    applyLayerVisibility()
    scheduleViewWeather()
    // 无论 2D 还是 3D，都更新风场
    restartWindForSettledView()
})
  map.on('style.load',restoreLayers)
}
function changeBasemap(){
  if(!map||!basemapOptions[basemap.value])return
  if(rememberBasemap.value)localStorage.setItem('medical-basemap-v1',basemap.value)
  map.setStyle(basemapOptions[basemap.value].style)
  map.once('idle',()=>{
    updateWindVisibility()
    drawWindLayer()
    startWindAnimation()
  })
  toast(`底图已切换为${basemapOptions[basemap.value].name}`)
}
function changeBasemapMemory(){
  localStorage.setItem('medical-basemap-remember-v1',String(rememberBasemap.value))
  if(rememberBasemap.value)localStorage.setItem('medical-basemap-v1',basemap.value)
  else localStorage.removeItem('medical-basemap-v1')
  toast(rememberBasemap.value?'下次打开将保留当前底图':'已恢复为每次打开使用科技暗色底图')
}
 function updateWindVisibility(){
   if(!map)return
   const bounds=map.getBounds(),z=map.getZoom()
   const intersectsShanghai=
     bounds.getEast()>=121.0&&bounds.getWest()<=121.9&&
     bounds.getNorth()>=30.7&&bounds.getSouth()<=31.7
   windCanvasVisible.value=!capacityPage.value&&layerVisible.value.weather&&z>=8.5&&z<=18&&intersectsShanghai
 }


function restoreLayers(){
  map.getStyle().layers.forEach(layer=>{
    if(layer.type!=='symbol')return
    const sourceLayer=layer['source-layer']||''
    if(/poi|transit|airport|natural_label/.test(sourceLayer)) map.setLayoutProperty(layer.id,'visibility','none')
    if(/road.*label/.test(sourceLayer)) map.setLayerZoomRange(layer.id,13.2,24)
  })
  Object.entries(sourceData()).forEach(([id,data])=>addSource(id,data))
  map.addLayer({id:'coverage',type:'fill',source:'coverage',paint:{'fill-color':'#24d7ff','fill-opacity':.055}})
  map.addLayer({id:'restrictions',type:'fill',source:'restrictions',paint:{'fill-color':'#ff365e','fill-opacity':.24}})
  const label=map.getStyle().layers.find(l=>l.type==='symbol'&&l.layout?.['text-field'])
  const buildingColors=basemap.value==='streets'
    ?['#ead9c3','#c58f5c','#895334']
    :basemap.value==='light'
      ?['#e8d9c7','#c3996c','#8c6244']
      :['#102842','#2371a3','#4bdfff']
  if(map.getSource('composite'))map.addLayer({id:'buildings',source:'composite','source-layer':'building',filter:['==',['get','extrude'],'true'],type:'fill-extrusion',minzoom:13.5,paint:{'fill-extrusion-color':['interpolate',['linear'],['get','height'],0,buildingColors[0],120,buildingColors[1],300,buildingColors[2]],'fill-extrusion-height':['get','height'],'fill-extrusion-base':['get','min_height'],'fill-extrusion-opacity':basemap.value==='dark'?.68:.7}},label?.id)
  addSemanticMarkers();updateMapData();
  applyLayerVisibility()
  nextTick(()=>{
    updateWindVisibility()
    drawWindLayer()
    startWindAnimation()
  })
  if(weather.value.updatedAt==='--')setTimeout(()=>map&&refreshWeather(),900)
  if(canViewFlight.value)nextTick(renderRemoteDrone)
  if(rotateMode.value)nextTick(applyRotateMode)
  if(role.value===ROLE.HOSPITAL&&!currentOrgFocused){
    currentOrgFocused=true
    nextTick(()=>map.flyTo({center:activeOrg.value.coordinates,zoom:11.2,pitch:0,bearing:0,duration:1200}))
  }
}
function addSemanticMarkers(){
  semanticMarkers.forEach(m=>m.remove());semanticMarkers=[]
  const bloodNodes=inventory.value.filter(s=>s.type==='血站').map(s=>({...s,id:s.orgId,name:s.org,kind:'blood'}))
  const approvedHospitals=inventory.value.filter(x=>x.type==='医院'&&!hospitals.some(h=>h.id===x.orgId)).map(x=>({id:x.orgId,name:x.org,address:x.address,coordinates:x.coordinates,kind:'hospital',registered:true}))
  const items=[...hospitals.map(h=>({...h,kind:'hospital'})),...approvedHospitals,...bloodNodes,...stations.map(s=>({...s,kind:'base'}))]
  items.forEach(item=>{
    const el=document.createElement('button');el.className=`poi ${item.kind}${item.registered?' registered':''}`;el.dataset.orgId=item.id;el.innerHTML=`<i>${item.kind==='hospital'?'✚':item.kind==='blood'?'♥':'H'}</i><span>${item.name}</span>`
    el.onclick=e=>{e.stopPropagation();new mapboxgl.Popup({offset:18}).setLngLat(item.coordinates).setHTML(`<b>${item.name}</b><br>${item.registered?'审核接入医院<br>': ''}${item.kind==='blood'?'血液库存与供给节点':item.kind==='base'?'无人机停放、充电与维修基地':item.address||'接入医院'}`).addTo(map)}
    semanticMarkers.push(new mapboxgl.Marker({element:el,anchor:'bottom'}).setLngLat(item.coordinates).addTo(map))
  })
  refreshMarkerStates()
  updateLabelScale()
  map.off('zoom',updateLabelScale);map.on('zoom',updateLabelScale)
  map.off('moveend',resolveMarkerOverlap);map.on('moveend',resolveMarkerOverlap)
  resolveMarkerOverlap()
}
function refreshMarkerStates(){
  if(typeof document==='undefined')return
  const open=tasks.value.filter(t=>!['任务完成','供给方拒绝'].includes(t.status))
  document.querySelectorAll('.poi[data-org-id]').forEach(el=>{
    const id=el.dataset.orgId
    const demand=open.some(t=>t.requesterId===id)
    const supplying=open.some(t=>t.supplierId===id)
    const current=role.value===ROLE.HOSPITAL&&loginOrg.value===id
    el.classList.toggle('demand',demand)
    el.classList.toggle('supplying',!demand&&supplying)
    el.classList.toggle('current-org',current)
  })
}
function resolveMarkerOverlap(){
  if(!map||!semanticMarkers.length)return
  semanticMarkers.forEach(marker=>marker.setOffset([0,0]))
  const visible=semanticMarkers
    .map((marker,index)=>({marker,index,point:map.project(marker.getLngLat())}))
    .filter(item=>item.marker.getElement().style.display!=='none')
  const remaining=new Set(visible.map(item=>item.index))
  while(remaining.size){
    const first=[...remaining][0],component=[],queue=[first]
    remaining.delete(first)
    while(queue.length){
      const id=queue.shift(),item=visible.find(v=>v.index===id)
      component.push(item)
      visible.forEach(other=>{
        if(!remaining.has(other.index))return
        if(Math.hypot(other.point.x-item.point.x,other.point.y-item.point.y)<38){
          remaining.delete(other.index);queue.push(other.index)
        }
      })
    }
    if(component.length<2)continue
    const cx=component.reduce((sum,item)=>sum+item.point.x,0)/component.length
    const cy=component.reduce((sum,item)=>sum+item.point.y,0)/component.length
    component.forEach((item,i)=>{
      let dx=item.point.x-cx,dy=item.point.y-cy
      if(Math.hypot(dx,dy)<.5){
        const angle=(Math.PI*2*i/component.length)-Math.PI/2
        dx=Math.cos(angle);dy=Math.sin(angle)
      }
      const length=Math.hypot(dx,dy),spread=20
      item.marker.setOffset([dx/length*spread,dy/length*spread])
    })
  }
}
function updateLabelScale(){
  const z=map.getZoom()
  poiLevel.value=z<8?'地球视图·点位已隐藏':z<9.15?'上海骨干节点':z<14.2?'全市医疗资源点位':'机构名称详情'
  document.querySelectorAll('.poi').forEach(el=>{
    const important=el.classList.contains('blood')||el.classList.contains('base')||el.classList.contains('demand')||el.classList.contains('supplying')
    const current=el.classList.contains('current-org')
    const layerEnabled=el.classList.contains('hospital')?layerVisible.value.hospitals:el.classList.contains('blood')?layerVisible.value.supply:el.classList.contains('base')?layerVisible.value.bases:true
    el.style.display=!layerEnabled||z<8||z<9.15&&!important?'none':'block'
    const scale=z<9.15?.58:z<10.5?.68:z<12?.82:1
    el.style.setProperty('--poi-scale',String(current?Math.max(scale,.9):scale))
    const label=el.querySelector('span')
    if(label)label.style.display=z>=14.2||current&&z>=10.5?'block':'none'
  })
  resolveMarkerOverlap()
}
function updateMapData(){
  if(!map?.isStyleLoaded())return
  if(routeIsSafe.value){addSource('air-route',airLine.value);if(!map.getLayer('air-glow'))map.addLayer({id:'air-glow',type:'line',source:'air-route',layout:{'line-elevation-reference':'ground'},paint:{'line-z-offset':120,'line-color':'#3de7ff','line-width':10,'line-opacity':.18}});if(!map.getLayer('air-route'))map.addLayer({id:'air-route',type:'line',source:'air-route',layout:{'line-elevation-reference':'ground'},paint:{'line-z-offset':120,'line-color':'#65f4ff','line-width':4,'line-dasharray':[2,1]}})}
  else map.getSource('air-route')?.setData(turf.featureCollection([]))
}
function focusTask(){
  if(!activeTask.value||!map)return
  const bounds=new mapboxgl.LngLatBounds()
  bounds.extend(activeTask.value.destination)
  if(selectedSupplier.value)bounds.extend(selectedSupplier.value.coordinates)
  map.stop()
  map.resize()
  requestAnimationFrame(()=>{
    map.fitBounds(bounds,{padding:110,maxZoom:14,duration:700})
    map.once('moveend',()=>{
      map.resize()
      restartWindForSettledView()
      clearTimeout(windRestartTimer)
      windRestartTimer=setTimeout(restartWindForSettledView,420)
    })
  })
}
function setMapView(mode){
  if(!map)return
  const currentCenter=map.getCenter()
  const currentZoom=map.getZoom()
  const currentBearing=map.getBearing()
  mapMode.value=mode
  map.easeTo({
    center:currentCenter,
    zoom:currentZoom,
    bearing:currentBearing,
    pitch:mode==='3d'?58:0,
    duration:650
  })
  updateWindVisibility()
  applyLayerVisibility()
  map.once('moveend',()=>{
    updateWindVisibility()
    applyLayerVisibility()
    startWindAnimation()
  })
}
function resetNorth(){map.easeTo({bearing:0,pitch:mapMode.value==='3d'?55:0,duration:500})}
function applyRotateMode(){
  if(!map)return
  rotateCleanup?.();rotateCleanup=null
  if(!rotateMode.value){map.dragPan.enable();map.getCanvas().style.cursor='';return}
  map.dragPan.disable()
  const canvas=map.getCanvas();canvas.style.cursor='grab'
  const down=e=>{
    if(e.button!==0)return
    e.preventDefault();e.stopPropagation();canvas.style.cursor='grabbing'
    const x=e.clientX,y=e.clientY,b=map.getBearing(),p=map.getPitch()
    const move=m=>{map.setBearing(b+(m.clientX-x)*.35);map.setPitch(Math.max(0,Math.min(75,p-(m.clientY-y)*.3)))}
    const up=()=>{canvas.style.cursor='grab';window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up)}
    window.addEventListener('mousemove',move);window.addEventListener('mouseup',up)
  }
  canvas.addEventListener('mousedown',down,true)
  rotateCleanup=()=>canvas.removeEventListener('mousedown',down,true)
}
function toggleRotate(){rotateMode.value=!rotateMode.value;applyRotateMode()}
function showMessagePanel(){clearTimeout(messageHideTimer);showMessages.value=true}
function hideMessagePanel(){clearTimeout(messageHideTimer);messageHideTimer=setTimeout(()=>showMessages.value=false,180)}
 function applyLayerVisibility(){
   const pairs={coverage:['coverage'],restrictions:['restrictions'],weather:['weather-wind','weather-wind-3d-glow','weather-wind-3d','weather-wind-heads'],air:['air-glow','air-route','planned-flight-glow','planned-flight'],ground:['ground-traffic'],buildings:['buildings']}
   Object.entries(pairs).forEach(([key,ids])=>ids.forEach(id=>map.getLayer(id)&&map.setLayoutProperty(id,'visibility',layerVisible.value[key]?'visible':'none')))
   if(map.getLayer('weather-wind'))map.setLayoutProperty('weather-wind','visibility','none')
   if(map.getLayer('weather-wind-3d-glow'))map.setLayoutProperty('weather-wind-3d-glow','visibility',!capacityPage.value&&layerVisible.value.weather&&mapMode.value==='3d'?'visible':'none')
   if(map.getLayer('weather-wind-3d'))map.setLayoutProperty('weather-wind-3d','visibility',!capacityPage.value&&layerVisible.value.weather&&mapMode.value==='3d'?'visible':'none')
   if(map.getLayer('weather-wind-heads'))map.setLayoutProperty('weather-wind-heads','visibility','none')
   const flightPage=page.value==='flight',dispatchPage=page.value==='dispatch',groundPage=page.value==='groundMonitor'
   ;['shared-flight-glow','shared-flight-route'].forEach(id=>map.getLayer(id)&&map.setLayoutProperty(id,'visibility',flightPage&&layerVisible.value.air?'visible':'none'))
   ;['planned-flight-glow','planned-flight'].forEach(id=>map.getLayer(id)&&map.setLayoutProperty(id,'visibility',(flightPage||dispatchPage)&&layerVisible.value.air?'visible':'none'))
   ;['air-glow','air-route'].forEach(id=>map.getLayer(id)&&map.setLayoutProperty(id,'visibility',dispatchPage&&layerVisible.value.air?'visible':'none'))
   if(map.getLayer('ground-traffic'))map.setLayoutProperty('ground-traffic','visibility',(dispatchPage||groundPage)&&layerVisible.value.ground?'visible':'none')
   if(map.getLayer('drone-altitude-column'))map.setLayoutProperty('drone-altitude-column','visibility',flightPage&&mapMode.value==='3d'?'visible':'none')
   updateLabelScale()
   updateWindVisibility()
 }

async function refreshTraffic(){
  if(!activeTask.value||!selectedSupplier.value)return
  trafficLoading.value=true;trafficStatus.value='正在获取道路交通数据'
  const a=selectedSupplier.value.coordinates.join(','),b=activeTask.value.destination.join(',')
  try{
    const res=await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${a};${b}?geometries=geojson&overview=full&annotations=congestion&access_token=${mapboxgl.accessToken}`)
    const json=await res.json(),route=json.routes?.[0];if(!route)throw Error('未返回路线')
    const baseMinutes=Math.round(route.duration/60);groundMinutes.value=Math.max(baseMinutes,Math.round((route.distance/1000)/.55*trafficPeriod.value.factor));groundDistance.value=(route.distance/1000).toFixed(1)
    const c=route.geometry.coordinates,con=route.legs[0]?.annotation?.congestion||[]
    addSource('ground-traffic',turf.featureCollection(c.slice(0,-1).map((p,i)=>turf.lineString([p,c[i+1]],{level:con[i]||'unknown'}))))
    if(!map.getLayer('ground-traffic'))map.addLayer({id:'ground-traffic',type:'line',source:'ground-traffic',paint:{'line-width':5,'line-color':['match',['get','level'],'severe','#ff234b','heavy','#ff7a1a','moderate','#ffd638','low','#35d879','#71849c']}})
    trafficStatus.value=`${trafficPeriod.value.name}·${trafficPeriod.value.level}｜模拟修正ETA ${groundMinutes.value}分钟 · ${groundDistance.value}km · ${new Date().toLocaleTimeString()}更新`
    drawChart()
  }catch(e){
    const from=selectedSupplier.value.coordinates,to=activeTask.value.destination
    const direct=turf.distance(turf.point(from),turf.point(to),{units:'kilometers'}),roadKm=direct*1.38
    groundDistance.value=roadKm.toFixed(1);groundMinutes.value=Math.round(roadKm/0.55*trafficPeriod.value.factor)
    const level=trafficPeriod.value.factor>1.7?'severe':trafficPeriod.value.factor>1.4?'heavy':trafficPeriod.value.factor>1.1?'moderate':'low'
    addSource('ground-traffic',turf.featureCollection([turf.lineString([from,[(from[0]+to[0])/2+.002,(from[1]+to[1])/2-.001],to],{level})]))
    if(!map.getLayer('ground-traffic'))map.addLayer({id:'ground-traffic',type:'line',source:'ground-traffic',paint:{'line-width':5,'line-color':['match',['get','level'],'severe','#ff234b','heavy','#ff7a1a','moderate','#ffd638','low','#35d879','#71849c']}})
    trafficStatus.value=`${trafficPeriod.value.name}·${trafficPeriod.value.level}｜仿真车流ETA ${groundMinutes.value}分钟（实时接口不可用）`
    drawChart()
  }finally{
    trafficLoading.value=false
    deliveryMode.value=(weatherAssessment.value.level==='禁止放飞'||Number(groundMinutes.value)<Number(airMinutes.value))?'ground':'air'
  }
}
function drawChart(){
  if(!chartEl.value)return;chart ||= echarts.init(chartEl.value)
  chart.setOption({grid:{left:30,right:10,top:24,bottom:25},xAxis:{type:'category',data:['地面配送','低空配送'],axisLabel:{color:'#8ca5c5'}},yAxis:{type:'value',axisLabel:{color:'#8ca5c5'},splitLine:{lineStyle:{color:'#1c3858'}}},series:[{type:'bar',data:[groundMinutes.value||30,airMinutes.value],itemStyle:{color:p=>p.dataIndex?'#35dff4':'#ff9b41'},label:{show:true,position:'top',color:'#d9efff',formatter:'{c}min'}}]})
}
function showPlannedRoute(task){
  if(!map?.isStyleLoaded()||!task)return
  const drone=fleet.value.find(d=>d.id===(task.droneId||selectedDrone.value?.id)),supplier=inventory.value.find(s=>s.orgId===task.supplierId)
  if(!drone||!supplier)return
  const base=stations.find(s=>s.id===drone.baseId)||stations[0]
  const batchStops=(task.batchTaskIds||[]).map(id=>tasks.value.find(t=>t.id===id)?.destination).filter(Boolean)
  const lastStop=batchStops.at(-1)||task.destination
  const returnBase=[...stations].sort((a,b)=>{
    const routeA=buildSafeLeg(lastStop,a.coordinates)
    const routeB=buildSafeLeg(lastStop,b.coordinates)
    return (routeA.properties.distanceKm||Infinity)-(routeB.properties.distanceKm||Infinity)
  })[0]
  const deliveryStops=[task.destination,...batchStops]
  const annotateLeg=(route,leg,name)=>({
    ...route,
    properties:{...route.properties,taskId:task.id,leg,name}
  })
  const features=[
    annotateLeg(buildSafeLeg(base.coordinates,supplier.coordinates),'reposition','保障基地→供给点'),
    ...deliveryStops.map((stop,index)=>annotateLeg(
      buildSafeLeg(index?deliveryStops[index-1]:supplier.coordinates,stop),
      'delivery',
      index?'需求医院→下一需求医院':'供给点→需求医院'
    )),
    annotateLeg(buildSafeLeg(deliveryStops.at(-1),returnBase.coordinates),'return','最后需求医院→返航基地')
  ]
  if(features.some(routeHasConflict)){
    addSource('planned-flight',turf.featureCollection([]))
    toast('完整航线存在禁飞区冲突，已停止展示并禁止执行')
    return
  }
  const route=turf.featureCollection(features)
  addSource('planned-flight',route)
  if(!map.getLayer('planned-flight-glow'))map.addLayer({id:'planned-flight-glow',type:'line',source:'planned-flight',layout:{'line-elevation-reference':'ground'},paint:{'line-z-offset':120,'line-color':'#43e8ff','line-width':13,'line-opacity':.16}})
  if(!map.getLayer('planned-flight'))map.addLayer({id:'planned-flight',type:'line',source:'planned-flight',layout:{'line-elevation-reference':'ground'},paint:{'line-z-offset':120,'line-color':['match',['get','leg'],'reposition','#b06cff','delivery','#54efff','return','#45df9f','#79f6ff'],'line-width':4,'line-dasharray':['match',['get','leg'],'reposition',['literal',[1,1]],'return',['literal',[3,2]],['literal',[2,1]]]}})
  const bounds=new mapboxgl.LngLatBounds();features.forEach(f=>f.geometry.coordinates.forEach(c=>bounds.extend(c)));map.fitBounds(bounds,{padding:100,maxZoom:14,duration:700})
}
function ensureFlightMarker(drone,coordinates,altitude=120){
  if(!droneMarker||!droneMarker.getElement()?.isConnected){
    const el=document.createElement('div');el.className='uav';el.innerHTML=`<i>✣</i><span>${drone.id}</span>`
    droneMarker=new mapboxgl.Marker({element:el,rotationAlignment:'map'}).setLngLat(coordinates).setAltitude(120).addTo(map)
  }
  if(!droneGroundMarker||!droneGroundMarker.getElement()?.isConnected){
    const ground=document.createElement('div');ground.className='uav-ground';ground.innerHTML='<i></i>'
    droneGroundMarker=new mapboxgl.Marker({element:ground,anchor:'center'}).setLngLat(coordinates).addTo(map)
  }
  const landmarks=[
    ...hospitals.map(h=>({name:h.name,coordinates:h.coordinates})),
    ...inventory.value.map(x=>({name:x.org,coordinates:x.coordinates})),
    ...stations.map(s=>({name:s.name,coordinates:s.coordinates}))
  ]
  const nearest=landmarks.sort((a,b)=>turf.distance(turf.point(coordinates),turf.point(a.coordinates))-turf.distance(turf.point(coordinates),turf.point(b.coordinates)))[0]
  const distance=nearest?turf.distance(turf.point(coordinates),turf.point(nearest.coordinates),{units:'kilometers'}):0
  const locationLabel=nearest?`${nearest.name}${distance<.15?'上空':`附近上空 · ${distance.toFixed(1)}km`}`:'上海城区上空'
  droneMarker.getElement().querySelector('span').textContent=`${drone.id} · ${locationLabel}`
  droneMarker.setLngLat(coordinates).setAltitude(altitude)
  droneGroundMarker.setLngLat(coordinates)
  const column=turf.circle(coordinates,.012,{units:'kilometers',steps:12,properties:{height:Math.max(1,altitude)}})
  addSource('drone-altitude-column',column)
  if(!map.getLayer('drone-altitude-column'))map.addLayer({id:'drone-altitude-column',type:'fill-extrusion',source:'drone-altitude-column',paint:{'fill-extrusion-base':0,'fill-extrusion-height':['get','height'],'fill-extrusion-color':'#48e8f5','fill-extrusion-opacity':.38}})
  return locationLabel
}
function flyLeg(task,from,to,stage,onArrive,steps=50){
  clearInterval(flightTimer)
  const drone=fleet.value.find(d=>d.id===task.droneId)
  if(!drone){toast('无法启动飞行：执行无人机不存在');return}
  const route=buildSafeLeg(from,to)
  if(route.properties.safe===false){toast('该航段无法生成不穿越禁飞区的安全路线，已阻止飞行');return}
  const km=turf.length(route,{units:'kilometers'});let step=0
  selectedTaskId.value=task.id;page.value='flight';mapMode.value='3d';autoOpenedFlightTasks.add(task.id)
  const initialLocation=ensureFlightMarker(drone,from);map.easeTo({pitch:62,zoom:15.5,center:from,duration:800})
  drone.status=stage;task.status=stage
  flightTelemetry.value={taskId:task.id,stage,progress:0,longitude:from[0],latitude:from[1],locationLabel:initialLocation,battery:drone.battery,temperature:4.2,altitude:120,speed:54,eta:`约${Math.max(1,Math.ceil(km/.7))}分钟`}
  task.telemetry={...flightTelemetry.value}
  save()
  flightTimer=setInterval(()=>{
    step++;const point=turf.along(route,km*step/steps,{units:'kilometers'}),coordinates=point.geometry.coordinates
    drone.battery=Math.max(10,Number((drone.battery-.16).toFixed(1)));drone.coordinates=coordinates
    const altitude=step<4?step*30:step>steps-4?(steps-step)*30:120
    const locationLabel=ensureFlightMarker(drone,coordinates,Math.max(0,altitude))
    flightTelemetry.value={...flightTelemetry.value,taskId:task.id,stage,progress:Math.round(step/steps*100),longitude:Number(coordinates[0].toFixed(6)),latitude:Number(coordinates[1].toFixed(6)),locationLabel,battery:drone.battery,temperature:Number((4.1+Math.sin(step/8)*.2).toFixed(1)),altitude:Math.max(0,altitude),speed:step>=steps?0:54,eta:step>=steps?'已抵达':`约${Math.max(1,Math.ceil((steps-step)*km/steps/.7))}分钟`}
    task.telemetry={...flightTelemetry.value}
    if(followDrone.value&&step%4===0)map.easeTo({center:coordinates,duration:250})
    save()
    if(step>=steps){clearInterval(flightTimer);onArrive(drone)}
  },400)
}
function startFlight(){
  const task=activeTask.value,supplier=inventory.value.find(s=>s.orgId===activeTask.value?.supplierId),drone=fleet.value.find(d=>d.id===activeTask.value?.droneId)
  if(!task||!supplier||!drone){toast('无法启动飞行：任务、供给点或无人机数据不完整');return}
  const base=stations.find(s=>s.id===drone.baseId)||stations[0]
  showPlannedRoute(task)
  flyLeg(task,base.coordinates,supplier.coordinates,'前往供给点',(d)=>{
    task.status='等待供给机构确认装货';d.status='供给点等待装货';d.coordinates=supplier.coordinates
    flightTelemetry.value={...flightTelemetry.value,stage:'已抵达供给点·等待装货确认',progress:100,altitude:0,speed:0,eta:'等待确认'}
    task.timeline.push({name:`无人机抵达${task.supplier}，等待装货`,time:new Date().toLocaleTimeString(),by:d.id})
    addMessage('无人机已到达供给点',`${d.id}已抵达，请确认物资装载完成`,ROLE.HOSPITAL,task.id,task.supplierId);save()
  })
}
function confirmLoaded(task){
  if(role.value!==ROLE.HOSPITAL||loginOrg.value!==task.supplierId||task.status!=='等待供给机构确认装货'){toast('只有供给机构可以确认装货');return}
  const supplier=inventory.value.find(s=>s.orgId===task.supplierId),drone=fleet.value.find(d=>d.id===task.droneId)
  task.timeline.push({name:'供给机构确认装货完成',time:new Date().toLocaleTimeString(),by:task.supplier})
  addMessage('物资已装载',`${task.droneId}开始飞往${task.requester}`,ROLE.DISPATCH,task.id)
  flyLeg(task,supplier.coordinates,task.destination,'携带物资前往需求医院',(d)=>{
    task.status='等待需求医院签收';d.status='需求医院等待签收';d.coordinates=task.destination
    flightTelemetry.value={...flightTelemetry.value,stage:'已抵达需求医院·等待收货确认',progress:100,altitude:0,speed:0,eta:'已抵达'}
    task.timeline.push({name:'无人机抵达需求医院，等待收货',time:new Date().toLocaleTimeString(),by:d.id})
    addMessage('物资已抵达',`${d.id}已抵达，请核对并确认收货`,ROLE.HOSPITAL,task.id,task.requesterId);addMessage('等待医院收货',`${task.id}已抵达${task.requester}`,ROLE.DISPATCH,task.id);save()
  })
}
function renderRemoteDrone(){
  if(!map||!canViewFlight.value)return
  mapMode.value='3d'
  const task=telemetryTask.value,supplier=inventory.value.find(x=>x.orgId===task?.supplierId)
  if(task&&supplier){
    const sharedRoute=buildSafeLeg(supplier.coordinates,task.destination)
    addSource('shared-flight-route',routeHasConflict(sharedRoute)?turf.featureCollection([]):sharedRoute)
    if(!map.getLayer('shared-flight-glow'))map.addLayer({id:'shared-flight-glow',type:'line',source:'shared-flight-route',layout:{'line-elevation-reference':'ground'},paint:{'line-z-offset':120,'line-color':'#45efff','line-width':12,'line-opacity':.18}})
    if(!map.getLayer('shared-flight-route'))map.addLayer({id:'shared-flight-route',type:'line',source:'shared-flight-route',layout:{'line-elevation-reference':'ground'},paint:{'line-z-offset':120,'line-color':'#7cf7ff','line-width':4,'line-dasharray':[2,1]}})
  }
  if(!droneMarker||!droneMarker.getElement()?.isConnected){
    const el=document.createElement('div');el.className='uav';el.innerHTML=`<i>✣</i><span>${telemetryTask.value?.droneId||'UAV'}</span>`
    droneMarker=new mapboxgl.Marker({element:el,rotationAlignment:'map'}).setLngLat([flightTelemetry.value.longitude,flightTelemetry.value.latitude]).setAltitude(120).addTo(map)
  }
  droneMarker.setLngLat([flightTelemetry.value.longitude,flightTelemetry.value.latitude]).setAltitude(flightTelemetry.value.altitude||0)
  if(map.getPitch()<45)map.easeTo({center:[flightTelemetry.value.longitude,flightTelemetry.value.latitude],pitch:62,zoom:15.5,duration:900})
}
function clearFlightVisualization(){
  droneMarker?.remove();droneMarker=null;droneGroundMarker?.remove();droneGroundMarker=null
  const empty=turf.featureCollection([])
  ;['planned-flight','shared-flight-route','air-route','route','corridor','drone-altitude-column'].forEach(id=>map?.getSource(id)?.setData(empty))
  flightTelemetry.value={taskId:'',stage:'待命',progress:0,longitude:null,latitude:null,battery:100,temperature:4.2,altitude:0,speed:0,eta:'--'}
}
function startReturnFlight(t){
  const nearest=[...stations].sort((a,b)=>turf.distance(turf.point(a.coordinates),turf.point(t.destination))-turf.distance(turf.point(b.coordinates),turf.point(t.destination)))[0]
  droneMarker?.remove()
  const el=document.createElement('div');el.className='uav';el.innerHTML=`<i>✣</i><span>${t.droneId}</span>`
  droneMarker=new mapboxgl.Marker({element:el,rotationAlignment:'map'}).setLngLat(t.destination).setAltitude(120).addTo(map)
  const d=fleet.value.find(x=>x.id===t.droneId)
  if(d)ensureFlightMarker(d,t.destination,120)
  if(d)d.status='返航中'
  const returnRoute=buildSafeLeg(t.destination,nearest.coordinates),returnKm=turf.length(returnRoute,{units:'kilometers'})
  let step=0;clearInterval(flightTimer);flightTimer=setInterval(()=>{step++;const p=turf.along(returnRoute,returnKm*step/50,{units:'kilometers'});if(d)ensureFlightMarker(d,p.geometry.coordinates,step<47?120:Math.max(0,(50-step)*40))
    if(d){d.battery=Math.max(10,Number((d.battery-.12).toFixed(1)));d.coordinates=p.geometry.coordinates}flightTelemetry.value={...flightTelemetry.value,taskId:t.id,stage:`返航至${nearest.name}`,progress:step*2,longitude:Number(p.geometry.coordinates[0].toFixed(6)),latitude:Number(p.geometry.coordinates[1].toFixed(6)),battery:d?.battery||flightTelemetry.value.battery,altitude:step<47?120:Math.max(0,(50-step)*40),speed:48,eta:`约${Math.max(1,Math.ceil((50-step)*.03))}分钟`};t.telemetry={...flightTelemetry.value}
    if(step>=50){clearInterval(flightTimer);const root=t.batchParentId?tasks.value.find(x=>x.id===t.batchParentId):t;const batch=[root,...(root?.batchTaskIds||[]).map(id=>tasks.value.find(x=>x.id===id))].filter(Boolean);batch.forEach(x=>{x.status='任务完成';x.returnBase=nearest.name;x.timeline.push({name:`无人机返回${nearest.name}，联运批次完成`,time:new Date().toLocaleTimeString(),by:t.droneId})});if(d){d.status='空闲';d.baseId=nearest.id;d.baseName=nearest.name;d.coordinates=nearest.coordinates}addMessage('任务闭环完成',`${t.droneId}已返回${nearest.name}，联运任务已归档`,ROLE.DISPATCH,t.id);clearFlightVisualization();save()}
  },140)
}
function markMessagesRead(){messages.value.filter(m=>!m.role||m.role===role.value).forEach(m=>m.read=true);save()}
watch(layerVisible,applyLayerVisibility,{deep:true})
watch(loginOrg,resetRequestDraft)
watch(canViewFlight,(available)=>{
  if(!available||!isLoggedIn.value)return
  const task=telemetryTask.value||flyingTask.value
  if(task&&!autoOpenedFlightTasks.has(task.id))nextTick(()=>openFlightMonitor(task))
})
watch(page,()=>nextTick(()=>{
  asideEl.value?.scrollTo({top:0,behavior:'auto'})
  updateWindVisibility()
  setTimeout(()=>{
    map?.resize()
    updateWindVisibility()
    applyLayerVisibility()
    if(page.value==='flight'&&canViewFlight.value)renderRemoteDrone()
    if(windCanvasVisible.value)startWindAnimation()
    drawChart()
  },80)
}))
onMounted(()=>{
  if(syncChannel)syncChannel.onmessage=event=>{
    tasks.value=event.data.tasks||tasks.value;messages.value=event.data.messages||messages.value;inventory.value=event.data.inventory||inventory.value;fleet.value=event.data.fleet||fleet.value;flightTelemetry.value=event.data.telemetry||flightTelemetry.value
    const liveTask=tasks.value.find(t=>t.id===flightTelemetry.value.taskId&&['无人机调机中','前往供给点','携带物资前往需求医院','携带联运物资前往需求医院','已签收·无人机返航'].includes(t.status))
    const related=liveTask&&(role.value===ROLE.DISPATCH||role.value===ROLE.OPERATOR||loginOrg.value===liveTask.requesterId||loginOrg.value===liveTask.supplierId)
    if(isLoggedIn.value&&related&&!autoOpenedFlightTasks.has(liveTask.id))openFlightMonitor(liveTask)
    refreshMarkerStates()
    if(map)updateLabelScale()
    if(canViewFlight.value&&page.value==='flight')nextTick(renderRemoteDrone)
    if(isLoggedIn.value&&event.data.alert?.targetRole===role.value&&(!event.data.alert.targetOrg||event.data.alert.targetOrg===loginOrg.value))toast(`新待办：${event.data.alert.title}｜${event.data.alert.text}`)
  }
})
onBeforeUnmount(()=>{clearInterval(flightTimer);clearInterval(groundTimer);clearTimeout(weatherRefreshTimer);cancelAnimationFrame(windAnimation);rotateCleanup?.();syncChannel?.close();map?.remove();chart?.dispose()})
</script>

<template>
  <div v-if="!isLoggedIn" class="login">
    <section class="login-hero"><div class="brand"><i>✦</i><div><b>空中生命线</b><span>城市低空医疗协同调度平台</span></div></div><div class="hero-copy"><em>URBAN AIR MEDICAL NETWORK</em><h1>连接医疗资源<br>重构城市急送时效</h1><p>共享库存、供需协同、低空调度、全程追踪，让每一次紧急医疗物资流转都有可靠的空间决策依据。</p></div><div class="hero-flow"><span>物资申请</span><b>→</b><span>供给确认</span><b>→</b><span>智能调度</span><b>→</b><span>低空配送</span><b>→</b><span>签收返航</span></div></section>
    <section class="login-box"><div v-if="!showRegister"><em>SYSTEM ACCESS</em><h2>进入协同网络</h2><p>不同机构进入各自工作台，业务权限相互隔离。</p>
      <label>机构角色<select v-model="loginRole"><option v-for="r in LOGIN_ROLES" :key="r">{{r}}</option></select></label>
      <label v-if="loginRole===ROLE.HOSPITAL">医院或血液机构<select v-model="loginOrg"><option v-for="h in inventory" :key="h.orgId" :value="h.orgId">{{h.org}} · {{h.type}}</option></select></label>
      <label v-else>机构账号<input :value="loginRole===ROLE.DISPATCH?'dispatch':'operator'" disabled></label>
      <label>密码<input v-model="loginPassword" type="password" placeholder="统一演示密码 123456" @keyup.enter="login"></label>
      <button class="primary" @click="login">安全登录</button><small>演示密码：123456</small>
      <p class="register-entry">暂时没有账号？<button @click="showRegister=true;registerMessage=''">申请机构注册</button></p>
    </div><div v-else class="register-panel"><em>INSTITUTION REGISTRATION</em><h2>申请机构注册</h2><p>提交后进入调度中心审核列表，审核通过前不会加入地图、登录列表或共享库存。</p>
      <label>机构类型<input value="医院" disabled></label>
      <label>机构名称<input v-model="registerForm.name" placeholder="请输入医院完整名称"></label>
      <label>所属行政区<select v-model="registerForm.district"><option v-for="(_,district) in districtCenters" :key="district">{{district}}</option></select></label>
      <label>详细地址<input v-model="registerForm.address" placeholder="请输入道路、门牌号"></label>
      <label>联系人及电话<input v-model="registerForm.contact" placeholder="例如：张老师 138****0000"></label>
      <p v-if="registerMessage" class="register-message">{{registerMessage}}</p>
      <button class="primary" @click="submitRegistration">提交注册申请</button>
      <button class="back-login" @click="showRegister=false;registerMessage=''">返回登录</button>
    </div></section>
  </div>

  <div v-else class="shell" :class="{capacityMode:(page==='fleet'&&role===ROLE.DISPATCH)||(page==='architecture'&&role===ROLE.OPERATOR)}">
    <header><div class="brand"><i>✦</i><div><b>空中生命线</b><span>医疗资源协同与低空调度</span></div></div>
      <nav>
        <button v-if="role===ROLE.DISPATCH" :class="{active:page==='overview'}" @click="page='overview'">调度总览</button>
        <button v-if="role===ROLE.DISPATCH" :class="{active:page==='dispatch'}" @click="page='dispatch'">任务调度<i v-if="pendingDispatch">{{pendingDispatch}}</i></button>
        <button v-if="role===ROLE.HOSPITAL" :class="{active:page==='requests'}" @click="page='requests'">物资申请</button>
        <button v-if="role===ROLE.HOSPITAL" :class="{active:page==='supplyTodo'}" @click="page='supplyTodo'">供给待办<i v-if="pendingSupply">{{pendingSupply}}</i></button>
        <button v-if="role===ROLE.HOSPITAL" :class="{active:page==='inventory'}" @click="page='inventory'">共享库存</button>
        <button v-if="role!==ROLE.OPERATOR" :class="{active:page==='tasks'}" @click="page='tasks'">任务中心<i v-if="role===ROLE.DISPATCH?dispatchTaskCount:pendingReceiptCount">{{role===ROLE.DISPATCH?dispatchTaskCount:pendingReceiptCount}}</i></button>
        <button v-if="role===ROLE.OPERATOR||role===ROLE.DISPATCH" :class="{active:page==='fleet'}" @click="page='fleet'">{{role===ROLE.DISPATCH?'无人机运力':'无人机运营'}}</button>
        <button v-if="role===ROLE.OPERATOR" :class="{active:page==='architecture'}" @click="page='architecture'">运力概览</button>
        <button v-if="canViewFlight" :class="{active:page==='flight'}" @click="page='flight'">飞行监控</button>
        <button v-if="role===ROLE.DISPATCH" :class="{active:page==='institutions'}" @click="page='institutions'">机构审核<i v-if="pendingReview">{{pendingReview}}</i></button>
      </nav>
      <div class="head-actions"><button class="bell" @mouseenter="showMessagePanel();markMessagesRead()" @mouseleave="hideMessagePanel">♢<i v-if="unread">{{unread}}</i></button><span>{{role}}</span><button v-if="role===ROLE.HOSPITAL" class="cancel-account" @click="cancelInstitutionAccount">注销账号</button><button @click="resetDemoData">重置演示</button><button @click="logout">退出</button></div>
    </header>
    <div v-if="showMessages" class="messages" @mouseenter="showMessagePanel" @mouseleave="hideMessagePanel"><h3>通知与待办</h3><div v-for="m in visibleMessages" :key="m.id" @click="openMessage(m)"><b>{{m.title}}</b><p>{{m.text}}</p><small>{{m.time}}</small></div><div v-if="!visibleMessages.length" class="empty">暂无本机构消息</div></div>
    <main>
      <section class="map-wrap" :class="{mode3d:mapMode==='3d',flightContext:page==='flight'}"><div id="map"></div>
        
        <canvas v-show="windCanvasVisible && !capacityPage && mapMode==='2d'" ref="windCanvas" class="wind-particles" :class="`basemap-${basemap}`"></canvas>
        <div class="map-top glass"><button :class="{active:mapMode==='2d'}" @click="setMapView('2d')">2D态势</button><button :class="{active:mapMode==='3d'}" @click="setMapView('3d')">3D低空</button><button :class="{active:rotateMode}" @click="toggleRotate">{{rotateMode?'退出自由观察':'自由观察'}}</button><button @click="resetNorth">归正</button><label><input v-model="followDrone" type="checkbox">镜头跟随</label><button class="compass" :style="{transform:`rotate(${-mapBearing}deg)`}" @click="resetNorth"><b>N</b>▲</button></div>
        <div class="camera-hud glass">方向 {{mapBearing}}°　倾角 {{mapPitch}}°　缩放 {{mapZoom}}　·　{{poiLevel}}</div>
        <details class="layers glass"><summary>底图与图层</summary><label class="basemap-choice">地图风格<select v-model="basemap" @change="changeBasemap"><option v-for="(option,key) in basemapOptions" :key="key" :value="key">{{option.name}}</option></select></label><label class="remember-basemap"><input v-model="rememberBasemap" type="checkbox" @change="changeBasemapMemory">记住底图选择</label><div class="layer-divider">业务图层</div><label v-for="(_,key) in layerVisible" :key="key"><input v-model="layerVisible[key]" type="checkbox">{{({hospitals:'医院',supply:'供给机构',bases:'保障基地',coverage:'站点建议服务范围（仿真）',restrictions:'管制区',weather:'风向与风速',ground:'地面路线',air:'低空航线',buildings:'三维建筑'})[key]}}</label></details>
        <div class="legend glass">
  <!-- 医疗机构 -->
  <span><i class="blue">✚</i>普通医院</span>
  <span><i class="orange">✚</i>需求医院</span>
  <span><i class="purple">✚</i>供给医院</span>
  <span><i class="red">♥</i>血站</span>

  <!-- 基础设施 -->
  <span><i class="green">H</i>无人机中心</span>

  <!-- 航线 -->
  <span><i class="route reposition"></i>调机</span>
  <span><i class="route delivery"></i>载货</span>
  <span><i class="route returning"></i>返航</span>

  <!-- 禁飞区 -->
  <span><i class="no-fly"></i>禁飞区</span>

  <!-- 无人机 - 与地图无人机样式一致 -->
  <span><i class="drone-icon"></i>无人机</span>
</div>
        <div v-if="!capacityPage" class="weather-hud glass" :class="{collapsed:weatherCollapsed}"><div class="weather-title" @click="weatherCollapsed=!weatherCollapsed"><b>{{weather.temperature}}℃</b><span>{{displayedWind.label}} {{displayedWind.speed}}m/s</span><button>{{weatherCollapsed?'展开天气':'收起'}}</button></div><template v-if="!weatherCollapsed"><div class="wind-level"><button :class="{active:windLevel==='surface'}" @click="setWindLevel('surface')">地表10米</button><button :class="{active:windLevel==='lowair'}" @click="setWindLevel('lowair')">低空120米</button></div><p><span>适航判断 {{weatherAssessment.level}}</span><span>风的来向 {{displayedWind.direction}}°</span><span>阵风 {{weather.gust}}m/s</span><span>降水 {{weather.precipitation}}mm</span><span>能见度 {{weather.visibility}}km</span></p><small>{{weather.source}} · {{weather.updatedAt}} · 缩放或移动后按当前视窗重新采样</small><button class="weather-refresh" @click="refreshWeather">{{weatherLoading?'更新中':'更新天气'}}</button></template></div>
        <div v-if="canViewFlight&&page==='flight'" class="shared-flight-hud glass"><div><b>{{telemetryTask?.droneId}} · {{flightTelemetry.stage}}</b><span>{{telemetryTask?.supplier}} → {{telemetryTask?.requester}}</span></div><strong>{{flightTelemetry.progress}}%</strong><p><span>电量 {{flightTelemetry.battery}}%</span><span>高度 {{flightTelemetry.altitude}}m</span><span>速度 {{flightTelemetry.speed}}km/h</span><span>温度 {{flightTelemetry.temperature}}℃</span><span>ETA {{flightTelemetry.eta}}</span></p><small>实时位置 {{flightTelemetry.longitude}}, {{flightTelemetry.latitude}}</small></div>
      </section>
      <aside ref="asideEl">
        <div v-if="notice" class="toast">{{notice}}</div>
        <template v-if="page==='overview'">
          <em>DISPATCH OVERVIEW</em><h1>城市医疗调度总览</h1><p>用于发现待办、执行任务和运行异常；详细飞行数据统一进入飞行监控查看。</p>
          <div class="metrics"><div><b>{{networkHospitalCount}}</b><span>接入医院</span></div><div><b>{{inventory.length}}</b><span>共享节点</span></div><div><b>{{fleet.filter(d=>d.status==='空闲').length}}</b><span>可用无人机</span></div><div><b>{{pendingDispatch}}</b><span>待调度任务</span></div></div>
          <div class="traffic-now"><b>当前道路时段：{{trafficPeriod.name}}</b><span :style="{color:trafficPeriod.color}">{{trafficPeriod.level}}</span><small>交通时间修正系数 ×{{trafficPeriod.factor}}，用于没有真实交通数据时的仿真估算。</small></div>
          <h3>实时待办队列</h3><div v-for="t in tasks.filter(x=>x.status.includes('调度'))" :key="t.id" class="task priority" @click="openDispatch(t)"><b>{{t.priority}} · {{t.requester}}</b><span>{{t.material}} {{t.amount}}{{t.unit}}</span><small>{{t.status}}　→</small></div>
          <h3>执行中任务概况</h3><div v-for="t in flyingTasks" :key="t.id" class="task"><div><b>{{t.id}} · {{t.droneId}}</b><i>执行中</i></div><p>{{t.supplier}} → {{t.requester}}</p><span>{{t.status}}</span><button @click="openFlightMonitor(t)">进入飞行监控</button></div><div v-if="!flyingTasks.length" class="empty">当前没有执行中的低空任务</div>
          <div class="alert-strip"><b>运行告警</b><span>当前空域风险正常 · 1架无人机处于维护状态</span></div>
        </template>

        <template v-else-if="page==='requests'">
          <em>MEDICAL REQUEST</em><h1>发起医疗物资申请</h1><p>当前需求机构：<b>{{activeOrg.name}}</b>。可指定供给方，也可交由调度中心根据库存与空间距离协助匹配。</p>
          <div class="material-picker">
            <h3>选择血液或医疗物资 <small>支持多选，并分别填写数量</small></h3>
            <div class="material-grid"><button v-for="name in materialOptions" :key="name" :class="{selected:selectedMaterial(name)}" @click="toggleMaterial(name)"><i>{{selectedMaterial(name)?'✓':'+'}}</i>{{name}}</button></div>
            <div v-for="line in requestForm.selectedMaterials" :key="line.name" class="material-line"><b>{{line.name}}</b><input v-model.number="line.amount" type="number" min="1"><select v-model="line.unit"><option>U</option><option>ml</option><option>治疗量</option><option>袋</option><option>盒</option><option>支</option></select><button @click="toggleMaterial(line.name)">移除</button></div>
            <div class="custom-line"><input v-model="requestForm.customMaterial" placeholder="没有所需选项？填写其他药品、样本、器械或医疗物资"><input v-model.number="requestForm.customAmount" type="number" min="1" placeholder="数量"><input v-model="requestForm.customUnit" placeholder="单位"></div>
          </div>
          <div class="form"><label>紧急等级<select v-model="requestForm.priority"><option>一级紧急</option><option>二级优先</option><option>普通</option></select></label><label>要求送达（分钟）<input v-model.number="requestForm.deadline" type="number"></label><label class="full">意向供给医院或血站<select v-model="requestForm.preferredSupplier"><option value="AUTO">暂不指定，由调度中心协助匹配</option><option v-for="s in inventory.filter(x=>x.orgId!==activeOrg.id)" :key="s.orgId" :value="s.orgId">{{s.org}} · {{supplierStockText(s)}}</option></select></label><label class="full">用途和特殊要求<textarea v-model="requestForm.note" placeholder="例如手术备血、冷链温度、交接要求等"></textarea></label></div>
          <button class="primary" @click="submitRequest">提交申请并通知相关机构</button>
        </template>

        <template v-else-if="page==='inventory'">
          <em>SHARED INVENTORY</em><h1>医疗物资共享网络</h1><p>医院既可以是需求方，也可以在库存允许时成为供给方。库存由各机构自行维护。</p>
          <div v-for="(s,index) in sortedInventory" :key="s.orgId" class="inventory" :class="{mine:s.orgId===loginOrg}"><div><b>{{s.org}} <em v-if="index===0&&s.orgId===loginOrg">本机构</em></b><span :class="{online:s.online}">{{s.online?'在线':'离线'}}</span></div><p v-for="(n,k) in s.items" :key="k"><span>{{k}}</span><b>{{n}}</b><i v-if="s.orgId===loginOrg"><button @click="changeStock(s,k,-1)">−</button><button @click="changeStock(s,k,1)">＋</button></i></p></div>
          <h3>待供给确认</h3><div v-for="t in tasks.filter(x=>x.status==='等待供给确认'&&t.supplierId===loginOrg)" :key="t.id" class="approval"><b>{{t.requester}}申请{{t.material}}</b><p>{{t.amount}}{{t.unit}} · {{t.priority}} · {{t.note}}</p><div><button class="primary" @click="supplierDecision(t,true)">同意分配</button><button class="secondary" @click="supplierDecision(t,false)">无法提供</button></div></div>
        </template>
        <template v-else-if="page==='supplyTodo'">
          <em>SUPPLY APPROVAL</em><h1>本机构供给待办</h1><p>这里只显示明确向当前医院或血液机构提出的申请。确认前，调度中心不能继续处理。</p>
          <div v-if="!supplyTodos.length&&!loadingTodos.length&&!groundDispatchTodos.length" class="empty">当前机构没有等待处理的供给申请、装货或派车任务。</div>
          <div v-for="t in supplyTodos" :key="t.id" class="approval prominent"><div><b>{{t.priority}} · {{t.requester}}</b><span>等待本机构确认</span></div><h3>{{t.material}}</h3><p v-for="line in t.lineItems||[]" :key="line.name">{{line.name}}　{{line.amount}}{{line.unit}}</p><p>要求{{t.deadline}}分钟内送达 · {{t.note}}</p><div><button class="primary" @click="supplierDecision(t,true)">确认全部库存并同意供给</button><button class="secondary" @click="supplierDecision(t,false)">库存不足，拒绝申请</button></div></div>
          <h3 v-if="loadingTodos.length">无人机装货确认</h3><div v-for="t in loadingTodos" :key="t.id" class="approval prominent"><b>{{t.droneId}} 已抵达本机构</b><p>请完成{{t.material}} {{t.amount}}{{t.unit}}的核对、冷链装箱和装机操作。</p><button class="primary" @click="confirmLoaded(t)">确认已经装货，允许飞往需求医院</button></div>
          <h3 v-if="groundDispatchTodos.length">地面车辆派送</h3><div v-for="t in groundDispatchTodos" :key="t.id" class="approval prominent"><b>调度中心要求本机构派车</b><p>{{t.material}} {{t.amount}}{{t.unit}} → {{t.requester}}，预计道路用时{{t.groundEta}}分钟。</p><button class="primary" @click="dispatchGroundVehicle(t)">确认车辆已经装货并出发</button></div>
        </template>

        <template v-else-if="page==='tasks'">
          <em>TASK CENTER</em><h1>任务全生命周期</h1><p>不同角色只看到与本机构相关的任务和允许执行的操作。</p>
          <h3>进行中任务 <i class="count">{{activeTasks.length}}</i></h3>
          <div v-for="t in activeTasks" :key="t.id" class="task" :class="{receiptTodo:role===ROLE.HOSPITAL&&t.requesterId===activeOrg.id&&['等待需求医院签收','等待需求医院确认地面收货'].includes(t.status)}"><div><b>{{t.id}}</b><i>{{role===ROLE.HOSPITAL&&t.requesterId===activeOrg.id&&['等待需求医院签收','等待需求医院确认地面收货'].includes(t.status)?'待您签收':t.priority}}</i></div><h3>{{t.requester}} ← {{t.supplier||'待匹配供给方'}}</h3><p>{{t.material}} {{t.amount}}{{t.unit}}</p><span>{{t.status}}</span><div v-if="t.deliveryMode==='地面车辆'" class="ground-monitor"><div><b>{{t.vehicle||'等待供给机构安排车辆'}}</b><span>{{t.groundStage||'等待派车'}} · ETA {{t.groundEta}}分钟</span></div><i><em :style="{width:(t.groundProgress||0)+'%'}"></em></i><small>配送进度 {{t.groundProgress||0}}%</small></div><button v-if="role===ROLE.DISPATCH&&(t.status.includes('调度')||t.status==='等待调度匹配供给方')" @click="openDispatch(t)">进入任务调度</button><button v-if="t.droneId&&t.telemetry&&t.status!=='任务完成'" @click="openFlightMonitor(t)">进入飞行监控</button><button v-if="t.deliveryMode==='地面车辆'" @click="openGroundMonitor(t)">查看地面配送状态</button><button v-if="role===ROLE.HOSPITAL&&t.status==='等待供给机构派车'&&t.supplierId===activeOrg.id" class="primary ground-btn" @click="dispatchGroundVehicle(t)">确认车辆装货并出发</button><button v-if="role===ROLE.HOSPITAL&&t.status==='等待需求医院签收'&&t.requesterId===activeOrg.id" class="primary" @click="signTask(t)">核对物资并确认签收</button><button v-if="role===ROLE.HOSPITAL&&t.status==='等待需求医院确认地面收货'&&t.requesterId===activeOrg.id" class="primary ground-btn" @click="signGroundTask(t)">确认地面车辆物资收货</button><details><summary>查看流转记录</summary><small v-for="x in t.timeline" :key="x.time">{{x.time}}　{{x.name}}　{{x.by}}</small></details></div>
          <h3 class="history-title">历史记录 <i class="count">{{historyTasks.length}}</i></h3>
          <div v-for="t in historyTasks" :key="t.id" class="task history"><div><b>{{t.id}}</b><i>已归档</i></div><h3>{{t.requester}} ← {{t.supplier}}</h3><p>{{t.material}} {{t.amount}}{{t.unit}} · 执行无人机{{t.droneId}} · 返回{{t.returnBase}}</p><details><summary>查看完整记录</summary><small v-for="x in t.timeline" :key="x.time">{{x.time}}　{{x.name}}　{{x.by}}</small></details></div>
        </template>

        <template v-else-if="page==='dispatch'">
          <em>TASK DISPATCH</em><h1>{{activeTask?'任务调度 '+activeTask.id:'待调度任务'}}</h1>
          <div v-if="!activeTask"><p>从待办队列选择一项任务，系统不会自动载入固定演示任务。</p><div v-for="t in tasks.filter(x=>x.status==='等待调度受理'||x.status==='等待调度匹配供给方')" :key="t.id" class="task priority" @click="openDispatch(t)"><b>{{t.priority}} · {{t.requester}}</b><span>{{t.material}} {{t.amount}}{{t.unit}}</span><small>{{t.status}}　→</small></div><div v-if="!tasks.some(x=>x.status==='等待调度受理'||x.status==='等待调度匹配供给方')" class="empty">当前没有待调度任务</div></div>
          <template v-else>
            <div class="steps"><span v-for="n in 4" :key="n" :class="{active:dispatchStep>=n}">{{n}}</span></div>
            <div class="summary"><b>{{activeTask.requester}}</b><span>{{activeTask.material}} {{activeTask.amount}}{{activeTask.unit}} · {{activeTask.priority}}</span><small>{{activeTask.status}}</small></div>
            
            <template v-if="activeTask.status==='等待调度匹配供给方'">
              <h3>01 辅助匹配供给机构</h3>
              <p>系统按照物资库存、在线状态和空间距离评分推荐；调度中心只能发送申请，不能替供给方确认。</p>

  <!-- ===== 供给方列表（带折叠功能） ===== -->
              <div class="supplier-list-header" @click="supplierListExpanded = !supplierListExpanded">
                <span>
                  <b>候选供给方</b>
                  <i class="count">{{candidateSuppliers.length}}家</i>
                </span>
                <span class="toggle-icon">{{supplierListExpanded ? '▼ 收起' : '▶ 展开'}}</span>
              </div>

              <div v-for="(s,index) in (supplierListExpanded ? candidateSuppliers : candidateSuppliers.slice(0, 3))" 
                 :key="s.orgId" 
                 class="choice" 
                 :class="{selected:selectedSupplierId===s.orgId,disabled:!s.eligible}" 
                 @click="s.eligible && (selectedSupplierId=s.orgId) && (supplierListExpanded = false)">
                <b>{{s.org}} <em v-if="index===0&&s.eligible" class="recommended">推荐供给方</em></b>
                <span>库存 {{s.stock}} · 距离 {{s.distance.toFixed(1)}}km · 综合评分 {{s.score}}</span>
                <i>{{s.eligible?'可发起申请':'不可用'}}</i>
              </div>

  <!-- 折叠时显示还有多少家 -->
              <div v-if="!supplierListExpanded && candidateSuppliers.length > 3" class="more-hint">
                还有 {{candidateSuppliers.length - 3}} 家供给方，点击上方展开查看
              </div>

              <button class="primary" @click="assignSupplier">向推荐机构发送供给确认申请</button>
            </template>
            <template v-else-if="activeTask.status==='等待供给确认'"><div class="supply-lock"><b>等待供给方确认</b><span>申请已发送至 {{activeTask.supplier}}。在该机构明确同意前，调度中心无法受理、选择无人机或规划航线。</span><i>当前没有任何可执行的调度按钮</i></div></template>
            <template v-else-if="dispatchStep===1"><h3>01 受理任务</h3><p>供给方已确认物资，调度中心可以开始运力与航线分析。</p><button class="primary" @click="acceptDispatch">受理并开始调度</button></template>
            <template v-else-if="dispatchStep===2"><h3>02 无人机调机匹配</h3><p>系统推荐仅供参考，不会自动选中。请调度员明确点击无人机，系统才根据该无人机所在站点生成完整路线。当前批次估算载荷：<b>{{batchPayload}}kg</b>。</p><div v-for="(d,index) in candidateDrones.slice(0,5)" :key="d.id" class="choice" :class="{selected:selectedDroneId===d.id,disabled:!d.eligible}" @click="chooseDrone(d)"><b>{{d.id}} · {{d.baseName}} <em v-if="index===0&&d.eligible&&d.available" class="recommended">系统推荐</em><em v-else-if="d.shareSelected" class="recommended">联运共用</em></b><span>载重{{d.load}}kg · 电量{{d.battery}}% · 调机{{d.reposition.toFixed(1)}}km · 配送{{d.delivery.toFixed(1)}}km</span><i>{{d.reservation&&!d.shareSelected?'已分配给 '+d.reservation.id+'，不可重复派遣':d.shareSelected?'将与 '+d.reservation.id+' 共用':selectedDroneId===d.id?'已选择·路线已按本机位置生成':'点击选择后生成路线'}}</i></div><div class="coroute"><h3>多任务协调与联运</h3><p>已分配无人机但尚未起飞的任务也会显示。选择后，本任务将明确加入其联运批次，共同使用同一架无人机。</p><div v-for="t in coRouteCandidates.slice(0,8)" :key="t.id" :class="{ok:t.compatible,selected:selectedBatchTaskIds.includes(t.id),manual:!t.compatible}" @click="selectedBatchTaskIds.includes(t.id)?selectedBatchTaskIds.splice(selectedBatchTaskIds.indexOf(t.id),1):selectedBatchTaskIds.push(t.id)"><b><input type="checkbox" :checked="selectedBatchTaskIds.includes(t.id)" @click.stop="selectedBatchTaskIds.includes(t.id)?selectedBatchTaskIds.splice(selectedBatchTaskIds.indexOf(t.id),1):selectedBatchTaskIds.push(t.id)"> {{t.id}} · {{t.requester}}</b><span>{{t.supplier||'供给方待匹配'}} · 相对绕行{{t.detourRatio}}% <strong v-if="t.reservedDroneId">· 已占用 {{t.reservedDroneId}}</strong></span><i>{{t.reservedDroneId?'起飞前可合并：与本任务共用 '+t.reservedDroneId:(t.compatible?'系统推荐联运':'人工协调：'+t.reason)}}</i></div><small v-if="!coRouteCandidates.length">当前没有其他待协调任务。需要至少两家医院提交任务后才会出现任务选项。</small></div>
              <button class="secondary back-step" @click="dispatchStep = 1" style="margin-top: 8px;">← 返回上一步</button>
              <button class="primary" :disabled="!selectedDroneId" @click="confirmDrone">确认所选运力{{selectedBatchTaskIds.length?'与协调批次':''}}并分析路线</button></template>
            <template v-else-if="dispatchStep===3"><h3>03 地面与低空方案对比</h3><div class="route-cards"><div><b>地面配送</b><strong>{{groundMinutes||'--'}}min</strong><span>{{groundDistance||'--'}}km · {{trafficStatus}}</span></div><div><b>低空安全航线</b><strong>{{airMinutes}}min</strong><span>{{airKm.toFixed(1)}}km · 高度120m · 速度约54km/h</span></div></div><button class="secondary" @click="refreshTraffic">{{trafficLoading?'正在更新':'获取并评价道路交通'}}</button><div ref="chartEl" class="chart"></div><div class="weather-check" :class="weatherAssessment.className"><div><b>低空气象安全检查</b><strong>{{weatherAssessment.level}}</strong></div><p>{{weatherAssessment.text}}</p><div class="weather-points"><span v-for="w in routeWeather" :key="w.name"><b>{{w.name}}</b>{{w.windSpeed}}m/s · {{w.precipitation}}mm · {{w.visibility}}km</span></div><small>{{routeWeather[0]?.source||weather.source}} · 使用120米高度风场</small><button @click="analyzeRouteWeather">{{weatherLoading?'检查中':'重新检查航线天气'}}</button></div><div class="airspace-check" :class="{blocked:directRouteBlocked}"><b>空域与建筑安全检查</b><span>{{directRouteBlocked?'最短直飞路线穿越禁飞区，已禁止使用并生成外侧绕行航线。':'直飞路线未与当前禁飞区相交。'}}</span><small>三维运行航高120m；建筑图层按高度显示，航线采用安全走廊并避让高层建筑风险区域。</small></div><div class="transport-recommend" :class="{ground:transportAssessment.recommend.includes('地面')}"><b>{{transportAssessment.recommend}}</b><strong>预计节省 {{transportAssessment.saving}} 分钟 · 时效变化 {{transportAssessment.ratio}}%</strong><p>{{transportAssessment.text}}</p></div><div class="mode-choice"><button :class="{active:deliveryMode==='ground'}" @click="deliveryMode='ground'">采用地面车辆配送</button><button :class="{active:deliveryMode==='air'}" @click="deliveryMode='air'">采用低空无人机配送</button></div>
              <button class="secondary back-step" @click="dispatchStep = 2" style="margin-top: 8px;">← 返回上一步</button>
              <button v-if="deliveryMode==='air'" class="primary" :disabled="!groundMinutes||weatherAssessment.level==='禁止放飞'" @click="issueTask">{{weatherAssessment.level==='禁止放飞'?'天气超限，禁止下发':'下发无人机与安全绕行航线'}}</button><button v-else class="primary ground-btn" :disabled="!groundMinutes" @click="issueGroundTask">通知供给机构安排地面车辆</button></template>
            <template v-else><h3>04 调度方案已下发</h3><div class="summary"><b>{{activeTask.deliveryMode||'低空无人机'}}</b><span>{{activeTask.droneId?activeTask.droneId+' · ':''}}{{activeTask.status}}</span></div><button v-if="activeTask.droneId&&activeTask.telemetry" class="primary" @click="openFlightMonitor(activeTask)">进入独立飞行监控</button><button v-if="activeTask.deliveryMode==='地面车辆'" class="ground-btn primary" @click="openGroundMonitor(activeTask)">查看地面配送状态</button><button class="secondary" @click="page='tasks'">返回任务中心</button></template>
          </template>
        </template>

        <template v-else-if="page==='fleet'">
          <template v-if="role===ROLE.DISPATCH">
            <em>UAV CAPACITY ANALYSIS</em><h1>无人机运力态势</h1><p>集中查看当前可调度运力、站点分布、电量、载重与风险，为任务派遣提供依据。</p>
            <div class="analytics-kpi capacity-big"><div><b>{{fleet.length}}</b><span>机队总数</span></div><div><b>{{fleet.filter(d=>d.status==='空闲'&&d.health==='正常').length}}</b><span>立即可调度</span></div><div><b>{{fleet.filter(d=>d.status!=='空闲'&&d.health==='正常').length}}</b><span>执行或待命</span></div><div><b>{{fleet.filter(d=>d.health!=='正常').length}}</b><span>维护异常</span></div></div>
            <div class="capacity-columns"><section><h2>保障站点驻场运力</h2><div class="station-chart large"><div v-for="s in stations" :key="s.id"><b>{{s.name}}</b><i><em :style="{width:(fleet.filter(d=>d.baseId===s.id).length/Math.max(1,fleet.length)*100)+'%'}"></em></i><strong>{{fleet.filter(d=>d.baseId===s.id).length}}架</strong></div></div></section><section><h2>关键运力风险</h2><div class="capacity-risks large"><p><b>{{fleet.filter(d=>d.battery<45).length}}架</b><span>低电量</span></p><p><b>{{fleet.filter(d=>!d.cold).length}}架</b><span>无冷链</span></p><p><b>{{fleet.filter(d=>d.load>=8).length}}架</b><span>大载重</span></p><p><b>{{stations.filter(s=>!fleet.some(d=>d.baseId===s.id)).length}}个</b><span>空缺站点</span></p></div></section></div>
            <h2>机队电量与执行状态</h2><div class="fleet-grid"><div v-for="d in fleet" :key="d.id" class="drone"><div><b>{{d.id}}</b><span :class="{bad:d.health!=='正常'}">{{d.health}}</span></div><p>{{d.baseName}} · 载重{{d.load}}kg · 航程{{d.range}}km · {{d.status}}</p><div class="battery"><i :class="{low:d.battery<45}" :style="{width:d.battery+'%'}"></i></div><strong>{{d.battery}}%</strong></div></div>
          </template>
          <template v-else>
            <em>UAV OPERATION CENTER</em><h1>无人机运营与保障</h1><p>维护无人机位置、电量、健康状态和停放基地，并执行调度中心下发的放飞指令。</p>
            <div class="launch-orders"><h3>待放飞指令 <i class="count">{{launchOrders.length}}</i></h3><div v-for="t in launchOrders" :key="t.id"><b>{{t.id}} · {{t.droneId}}</b><span>{{t.supplier}} → {{t.requester}}</span><small>运营中心只做设备检查与放飞，不参与物资和路线调度。</small><button class="primary" @click="authorizeLaunch(t)">检查完成，确认放飞</button></div><p v-if="!launchOrders.length">当前没有待放飞任务。</p></div>
            <div v-if="flyingTask" class="live-flight"><h3>正在执行 · {{flyingTask.droneId}}</h3><b>{{flyingTask.telemetry?.stage||flightTelemetry.stage}}</b><i><em :style="{width:(flyingTask.telemetry?.progress||flightTelemetry.progress)+'%'}"></em></i><div><span>电量 {{flyingTask.telemetry?.battery||flightTelemetry.battery}}%</span><span>高度 {{flyingTask.telemetry?.altitude||flightTelemetry.altitude}}m</span><span>速度 {{flyingTask.telemetry?.speed||flightTelemetry.speed}}km/h</span><span>ETA {{flyingTask.telemetry?.eta||flightTelemetry.eta}}</span></div><button class="secondary" @click="openFlightMonitor(flyingTask)">查看该任务飞行状态</button></div>
            <div class="add-drone"><h3>新增无人机资产</h3><div><input v-model="newDrone.id" placeholder="编号，如 UAV-09"><input v-model.number="newDrone.load" type="number" placeholder="载重kg"><input v-model.number="newDrone.range" type="number" placeholder="航程km"><select v-model="newDrone.baseId"><option v-for="s in stations" :key="s.id" :value="s.id">{{s.name}}</option></select></div><button class="primary" @click="addDrone">添加无人机</button></div>
            <div class="base-row"><div v-for="s in stations" :key="s.id"><b>{{s.name}}</b><span>{{fleet.filter(d=>d.baseId===s.id).length}}架驻场</span></div></div>
            <div v-for="d in fleet" :key="d.id" class="drone"><div><b>{{d.id}}</b><span :class="{bad:d.health!=='正常'}">{{d.health}}</span></div><p>{{d.baseName}} · 电量{{d.battery}}% · 航程{{d.range}}km · {{d.status}}</p><div class="battery"><i :style="{width:d.battery+'%'}"></i></div><div class="fleet-actions"><button @click="updateFleet(d,'battery',Math.min(100,d.battery+10))">充电+10%</button><button @click="updateFleet(d,'health',d.health==='正常'?'维护中':'正常')">{{d.health==='正常'?'送修':'完成维修'}}</button><select :value="d.baseId" @change="updateDroneBase(d,$event.target.value)"><option v-for="s in stations" :key="s.id" :value="s.id">{{s.name}}</option></select><button class="delete" @click="removeDrone(d)">删除</button></div></div>
          </template>
        </template>
        <template v-else-if="page==='flight'">
          <div class="flight-page-head"><div><em>LIVE FLIGHT MONITOR</em><h1>三维飞行执行监控</h1></div><button @click="exitFlightMonitor">退出观看</button></div><div v-if="viewableFlyingTasks.length>1" class="flight-switch"><button v-for="t in viewableFlyingTasks" :key="t.id" :class="{active:selectedTaskId===t.id}" @click="openFlightMonitor(t)">{{t.id}} · {{t.droneId}}</button></div><p v-if="activeTask">{{activeTask.id}} · {{activeTask.supplier}} → {{activeTask.requester}}</p>
          <div v-if="!canViewFlight" class="empty">当前机构没有可以查看的执行中飞行任务。</div>
          <template v-else><div class="flight-stage"><b>{{monitorTelemetry.stage}}</b><span>{{monitorTelemetry.progress}}%</span><i><em :style="{width:monitorTelemetry.progress+'%'}"></em></i></div><div class="air-location"><b>当前空中位置</b><strong>{{monitorTelemetry.locationLabel||'正在定位附近地标'}}</strong></div><div class="telemetry six"><div><b>{{activeTask?.droneId}}</b><span>执行无人机</span></div><div><b>{{monitorTelemetry.battery}}%</b><span>剩余电量</span></div><div><b>{{monitorTelemetry.altitude}}m</b><span>真实高度</span></div><div><b>{{monitorTelemetry.speed}}km/h</b><span>当前速度</span></div><div><b>{{monitorTelemetry.temperature}}℃</b><span>货箱温度</span></div><div><b>{{monitorTelemetry.eta}}</b><span>预计到达</span></div></div><div class="coordinate">实时坐标：{{monitorTelemetry.longitude}}, {{monitorTelemetry.latitude}}</div><div class="flight-help">地图中的发光圆点表示无人机在地面的垂直投影，虚线连接无人机与地面位置；地标文字用于说明当前位于哪里上空。</div><button v-if="role===ROLE.HOSPITAL&&loginOrg===activeTask?.supplierId&&activeTask?.status==='等待供给机构确认装货'" class="primary" @click="confirmLoaded(activeTask)">确认物资已经装上无人机</button><button v-if="role===ROLE.HOSPITAL&&loginOrg===activeTask?.requesterId&&activeTask?.status==='等待需求医院签收'" class="primary" @click="signTask(activeTask)">确认需求医院已经收到物资</button><button v-if="role===ROLE.OPERATOR" class="secondary" @click="replayFlight">重新播放完整飞行过程</button></template>
        </template>
        <template v-else-if="page==='groundMonitor'">
          <div class="flight-page-head"><div><em>GROUND DELIVERY MONITOR</em><h1>地面配送状态</h1></div><button @click="page='tasks'">返回任务中心</button></div>
          <template v-if="activeTask?.deliveryMode==='地面车辆'"><p>{{activeTask.id}} · {{activeTask.supplier}} → {{activeTask.requester}}</p><div class="ground-monitor ground-monitor-large"><div><b>{{activeTask.vehicle||'等待供给机构安排车辆'}}</b><span>{{activeTask.groundStage||'等待派车'}}</span></div><i><em :style="{width:(activeTask.groundProgress||0)+'%'}"></em></i><small>配送进度 {{activeTask.groundProgress||0}}% · 预计道路用时 {{activeTask.groundEta}}分钟</small></div><div class="telemetry"><div><b>{{activeTask.vehicle||'--'}}</b><span>配送车辆</span></div><div><b>{{activeTask.groundProgress||0}}%</b><span>当前进度</span></div><div><b>{{activeTask.groundEta}}min</b><span>预计用时</span></div></div><div class="timeline"><p v-for="x in activeTask.timeline" :key="x.time"><i></i><b>{{x.name}}</b><span>{{x.time}} · {{x.by}}</span></p></div><button v-if="role===ROLE.HOSPITAL&&activeTask.status==='等待供给机构派车'&&activeTask.supplierId===activeOrg.id" class="primary ground-btn" @click="dispatchGroundVehicle(activeTask)">确认车辆装货并出发</button><button v-if="role===ROLE.HOSPITAL&&activeTask.status==='等待需求医院确认地面收货'&&activeTask.requesterId===activeOrg.id" class="primary ground-btn" @click="signGroundTask(activeTask)">确认物资收货</button></template><div v-else class="empty">没有可查看的地面配送任务</div>
        </template>
        <template v-else-if="page==='institutions'">
          <em>INSTITUTION REVIEW</em><h1>接入机构审核</h1><p>审核通过后机构才能进入医疗资源共享与低空调度网络。</p>
          <div v-if="!applications.length" class="empty">暂无机构注册申请。新机构从登录页提交申请后会显示在这里。</div>
          <div v-for="a in applications" :key="a.id" class="approval"><div><b>{{a.name}}</b><span>{{a.status}}</span></div><p>{{a.address}} · 联系人 {{a.contact}}</p><div v-if="a.status==='待审核'"><button class="primary" @click="reviewInstitution(a,true)">审核通过并加入地图</button><button class="secondary" @click="reviewInstitution(a,false)">驳回</button></div><button v-else-if="a.status==='审核通过'" class="secondary locate-institution" @click="focusInstitution(a)">在地图中定位</button></div>
        </template>
        <template v-else-if="page==='architecture'">
          <em>UAV CAPACITY OVERVIEW</em><h1>{{role===ROLE.OPERATOR?'无人机运力概览':'无人机运力分析'}}</h1><p>{{role===ROLE.OPERATOR?'集中查看机队可用率、驻场分布、电量和维护风险；资产增删与状态维护请进入“无人机运营”。':'仅展示调度决策需要的无人机运力信息，不统计与当前调度无关的物资类型。'}}</p>
          <div class="analytics-kpi capacity-big"><div><b>{{fleet.length}}</b><span>无人机总数</span></div><div><b>{{fleet.filter(d=>d.status==='空闲'&&d.health==='正常').length}}</b><span>立即可调度</span></div><div><b>{{fleet.filter(d=>d.status!=='空闲'&&d.health==='正常').length}}</b><span>执行或待命</span></div><div><b>{{fleet.filter(d=>d.health!=='正常').length}}</b><span>维护异常</span></div></div>
          <div class="capacity-columns"><section><h2>保障站点驻场运力</h2><div class="station-chart large"><div v-for="s in stations" :key="s.id"><b>{{s.name}}</b><i><em :style="{width:(fleet.filter(d=>d.baseId===s.id).length/Math.max(1,fleet.length)*100)+'%'}"></em></i><strong>{{fleet.filter(d=>d.baseId===s.id).length}}架</strong></div></div></section><section><h2>关键运力风险</h2><div class="capacity-risks large"><p><b>{{fleet.filter(d=>d.battery<45).length}}架</b><span>低电量</span></p><p><b>{{fleet.filter(d=>!d.cold).length}}架</b><span>无冷链</span></p><p><b>{{fleet.filter(d=>d.load>=8).length}}架</b><span>大载重</span></p><p><b>{{stations.filter(s=>!fleet.some(d=>d.baseId===s.id)).length}}个</b><span>空缺站点</span></p></div></section></div>
          <h2>机队电量与可用状态</h2><div class="fleet-grid"><div v-for="d in fleet" :key="d.id" class="drone"><div><b>{{d.id}}</b><span :class="{bad:d.health!=='正常'}">{{d.health}}</span></div><p>{{d.baseName}} · 载重{{d.load}}kg · 航程{{d.range}}km · {{d.status}}</p><div class="battery"><i :class="{low:d.battery<45}" :style="{width:d.battery+'%'}"></i></div><strong>{{d.battery}}%</strong></div></div>
        </template>
      </aside>
    </main>
  </div>
</template>
