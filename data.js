/* 山河手帖 · 数据层 —— 16 段旅行记忆（2019–2026） */
window.ATLAS = (function () {
  'use strict';

  const MOODS = ['治愈', '放空', '热血', '狂喜', '悸动', '忧郁', '震撼', '思念'];

  const THEME_ORDER = ['城市漫游', '山野徒步', '海岛与海', '美食之旅', '人文古迹', '公路之旅', '雪国极光', '沙漠星夜'];

  /* 手绘风线性小图标（stroke, viewBox 0 0 24 24） */
  const ICONS = {
    '城市漫游': '<path d="M3 21h18"/><path d="M5.5 21V9.5l5-2.6V21"/><path d="M10.5 21V4.6l6.5 2.8V21"/><path d="M7.6 12h.01M7.6 15h.01M7.6 18h.01M13.6 11h.01M13.6 14h.01M13.6 17h.01"/>',
    '山野徒步': '<path d="M2.5 20h19"/><path d="M4 20l6.6-13.6L15 14l2.6-4.4L21 20"/>',
    '海岛与海': '<path d="M2 9c2.2-2.6 4.8-2.6 7 0s4.8 2.6 7 0 3.3-1.8 6 .4"/><path d="M2 15c2.2-2.6 4.8-2.6 7 0s4.8 2.6 7 0 3.3-1.8 6 .4"/>',
    '美食之旅': '<path d="M4 12.5h16a8 8 0 0 1-16 0z"/><path d="M4.5 16.5h15"/><path d="M9.5 8.5c0-1.6 1-1.6 1-3.2M13.5 8.5c0-1.6 1-1.6 1-3.2"/>',
    '人文古迹': '<path d="M4 6.4c2.2.9 4.6 1.3 8 1.3s5.8-.4 8-1.3"/><path d="M6.2 6.6V20M17.8 6.6V20"/><path d="M4.5 11.5h15"/><path d="M12 7.7V20"/>',
    '公路之旅': '<path d="M7.5 3 4 21M16.5 3 20 21"/><path d="M12 4.5v2.5M12 10.5v3M12 17v2.8"/>',
    '雪国极光': '<path d="M12 3.5v17M5 7.3l14 9.4M19 7.3 5 16.7"/><path d="M12 3.5 10 5.6M12 3.5l2 2.1"/>',
    '沙漠星夜': '<path d="M2 18.5c3.5-4.4 6.8-4.2 10 0s6.5 3.9 10-1.5"/><path d="M15 4.5l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z"/>',
  };

  const P = (seed, w, h) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

  const entries = [
    {
      id: 'kyoto-2019', city: '京都', latin: 'KYOTO', country: '日本',
      coord: [35.0116, 135.7681], labelSide: 't', date: '2019-04-06', mood: '治愈', theme: '人文古迹',
      title: '京都的暮色，灯笼一盏盏亮起', note: '第一次一个人出门', zoom: 6,
      photos: [
        { url: 'assets/photos/kyoto-1.jpg', cap: '八坂塔下 · 暮色灯笼' },
        { url: 'assets/photos/kyoto-2.jpeg', cap: '东山 · 石板小路' },
        { url: 'assets/photos/kyoto-3.jpg', cap: '五重塔 · 落日剪影' },
      ],
      fragments: [
        { time: '05:50', text: '清晨的南禅寺几乎没有人，水声比钟声更早醒来。' },
        { time: '14:20', text: '在哲学之道走了两个小时，樱花落在肩上，舍不得拂掉。' },
        { time: '19:40', text: '巷子里的居酒屋只坐得下六个人，老板娘多送了我一块玉子烧。' },
      ],
    },
    {
      id: 'hongkong-2019', city: '香港', latin: 'HONG KONG', country: '中国',
      coord: [22.3193, 114.1694], labelSide: 'l', date: '2019-10-19', mood: '悸动', theme: '城市漫游',
      title: '庙街的霓虹，是热的', note: '会想念这种热', zoom: 6,
      photos: [
        { url: 'assets/photos/hongkong-1.jpg', cap: '油麻地 · 夜街车流' },
        { url: 'assets/photos/hongkong-2.jpeg', cap: '霓虹招牌 · 红与黄' },
        { url: 'assets/photos/hongkong-3.jpeg', cap: '霓虹字牌 · 特写' },
      ],
      fragments: [
        { time: '21:10', text: '从油麻地地铁站出来，霓虹灯牌一层叠一层，像掉进了老电影。' },
        { time: '23:05', text: '大排档的煲仔饭要等二十五分钟，锅巴的焦香证明等待值得。' },
        { time: '00:30', text: '天台看维港，对岸的灯一直亮到天边，心跳有点快。' },
      ],
    },
    {
      id: 'dali-2020', city: '大理', latin: 'DALI', country: '中国',
      coord: [25.6065, 100.2676], labelSide: 'l', date: '2020-08-15', mood: '放空', theme: '城市漫游',
      title: '在洱海边，把日子过成慢镜头', note: 'gap 的日子', zoom: 6,
      photos: [
        { url: 'assets/photos/dali-1.jpg', cap: '洱海 · 半岛村落' },
        { url: 'assets/photos/dali-2.jpg', cap: '白房子与木船' },
      ],
      fragments: [
        { time: '08:00', text: '骑电动车环海西路，风把头发吹成一团海草。' },
        { time: '15:30', text: '咖啡馆的猫睡在我笔记本旁边，一下午只写了三行字。' },
        { time: '20:10', text: '苍山的影子倒进洱海里，云走得比时间慢。' },
      ],
    },
    {
      id: 'qinghai-2021', city: '青海湖', latin: 'QINGHAI LAKE', country: '中国',
      coord: [36.7310, 99.7813], date: '2021-05-22', mood: '热血', theme: '公路之旅',
      title: '环湖公路上，风比车快', note: '油门到底的一天', zoom: 5,
      photos: [
        { url: 'assets/photos/qinghai-1.jpg', cap: '湖岸 · 湿地与沙丘' },
        { url: 'assets/photos/qinghai-2.jpg', cap: '茶卡 · 盐湖铁轨' },
      ],
      fragments: [
        { time: '06:30', text: '黑马河的日出把湖面烧成金色，帐篷外冷得直跺脚。' },
        { time: '12:40', text: '环湖西路没有人，油菜花田在车窗外退成一卷黄色长镜头。' },
        { time: '22:00', text: '茶卡的星空低得压在头顶，银河像有人打翻了一袋盐。' },
      ],
    },
    {
      id: 'xiamen-2021', city: '厦门', latin: 'XIAMEN', country: '中国',
      coord: [24.4798, 118.0894], date: '2021-10-03', mood: '治愈', theme: '美食之旅',
      title: '沙茶面的汤底，是八市的烟火', note: '胃是第二颗心脏', zoom: 6,
      photos: [
        { url: 'assets/photos/xiamen-1.jpg', cap: '中山路 · 骑楼夜色' },
        { url: 'assets/photos/xiamen-2.jpg', cap: '鹭岛 · 海岸天际线' },
      ],
      fragments: [
        { time: '07:30', text: '八市的海蛎还带着海水味，阿婆教我挑「紧一点的」。' },
        { time: '13:15', text: '一碗沙茶面下肚，甜辣的汤把整个下午都焐热了。' },
        { time: '17:50', text: '沙坡尾的渔船和咖啡店挤在一起，旧与新握手言和。' },
      ],
    },
    {
      id: 'changsha-2022', city: '长沙', latin: 'CHANGSHA', country: '中国',
      coord: [28.2282, 112.9388], labelSide: 't', date: '2022-01-28', mood: '狂喜', theme: '美食之旅',
      title: '凌晨两点，小龙虾还在上桌', note: '辣到怀疑人生', zoom: 6,
      photos: [
        { url: 'assets/photos/changsha-1.jpg', cap: '梅溪湖 · 城市暮色' },
        { url: 'assets/photos/changsha-2.jpg', cap: '摩天轮 · 城市夜' },
        { url: 'assets/photos/changsha-3.jpg', cap: '橘子洲 · 江边烟花' },
      ],
      fragments: [
        { time: '19:00', text: '文和友排队两个小时，进去才发现是一座「复古城市」。' },
        { time: '23:40', text: '夜宵摊的口味虾辣得眼泪汪汪，但手完全停不下来。' },
        { time: '01:50', text: '解放西路的夜才刚过半——长沙的夜，比想象中长得多。' },
      ],
    },
    {
      id: 'daocheng-2022', city: '稻城亚丁', latin: 'DAOCHENG', country: '中国',
      coord: [27.9660, 100.2960], labelSide: 'l', date: '2022-08-12', mood: '震撼', theme: '山野徒步',
      title: '牛奶海之上，只剩下呼吸声', note: '呼吸的重量', zoom: 6,
      photos: [
        { url: 'assets/photos/daocheng-1.jpg', cap: '牛奶海 · 不讲道理的蓝' },
        { url: 'assets/photos/daocheng-2.jpg', cap: '高原海子 · 云影' },
        { url: 'assets/photos/daocheng-3.jpg', cap: '山脚 · 红亭与村落' },
      ],
      fragments: [
        { time: '05:20', text: '海拔四千六，每走十步喘一口，牦牛都比我从容。' },
        { time: '11:35', text: '翻过最后一道山脊，牛奶海蓝得不讲道理，所有人都安静了。' },
        { time: '16:00', text: '下山时落起雪粒，夏天和冬天在同一座山头换班。' },
      ],
    },
    {
      id: 'iceland-2023', city: '雷克雅未克', latin: 'REYKJAVÍK', country: '冰岛',
      coord: [64.1466, -21.9426], date: '2023-02-18', mood: '狂喜', theme: '雪国极光',
      title: '极光来的那晚，整个天都在燃烧', note: '眼泪是热的', zoom: 4,
      photos: [
        { url: 'assets/photos/iceland-1.jpg', cap: '冰河湖 · 极光倒影' },
        { url: 'assets/photos/iceland-2.jpg', cap: '追光的人' },
        { url: 'assets/photos/iceland-3.webp', cap: '午夜 · 山与光帘' },
      ],
      fragments: [
        { time: '21:30', text: 'KP 指数爆表，车追着一块晴空跑了两个小时。' },
        { time: '23:50', text: '绿色的光帘从天顶垂下来，安静得能听见自己的心跳。' },
        { time: '01:20', text: '回程路上没人说话，每个人都在后座偷偷回头看天。' },
      ],
    },
    {
      id: 'chiangmai-2023', city: '清迈', latin: 'CHIANG MAI', country: '泰国',
      coord: [18.7883, 98.9853], labelSide: 'b', date: '2023-06-10', mood: '放空', theme: '城市漫游',
      title: '古城的午后，时间用脚步计量', note: '时间变慢了', zoom: 6,
      photos: [
        { url: 'assets/photos/chiangmai-1.jpeg', cap: '天灯 · 升空' },
        { url: 'assets/photos/chiangmai-2.jpg', cap: '素贴山 · 晨雾双塔' },
      ],
      fragments: [
        { time: '09:00', text: '周日夜市的余温还在，古城的狗睡得四仰八叉。' },
        { time: '14:30', text: '老咖啡馆里写明信片，风扇转得很慢，字也写得很慢。' },
        { time: '18:45', text: '素贴山的云海涌下来，把整座城泡进暮色里。' },
      ],
    },
    {
      id: 'paris-2023', city: '巴黎', latin: 'PARIS', country: '法国',
      coord: [48.8566, 2.3522], labelSide: 'l', date: '2023-11-24', mood: '忧郁', theme: '人文古迹',
      title: '十一月的巴黎，适合一个人走', note: '一个人的巴黎', zoom: 5,
      photos: [
        { url: 'assets/photos/paris-1.jpeg', cap: '塞纳河 · 秋日石桥' },
        { url: 'assets/photos/paris-2.jpg', cap: '蒙马特 · 石阶落叶' },
      ],
      fragments: [
        { time: '10:20', text: '奥赛博物馆五楼，看了一上午的梵高，眼睛发热。' },
        { time: '15:40', text: '塞纳河边的旧书摊收摊了，落叶被河水卷走。' },
        { time: '18:10', text: '蒙马特的台阶上冷风一阵一阵，城市在脚下亮起来，美得让人难过。' },
      ],
    },
    {
      id: 'sahara-2024', city: '梅尔祖卡', latin: 'MERZOUGA', country: '摩洛哥',
      coord: [31.0803, -4.0124], date: '2024-04-17', mood: '震撼', theme: '沙漠星夜',
      title: '撒哈拉的夜，星星密得让人失语', note: '失语的夜', zoom: 5,
      photos: [
        { url: 'assets/photos/sahara-1.jpg', cap: '驼队 · 暮色沙丘' },
        { url: 'assets/photos/sahara-2.jpg', cap: '牵驼人 · 入沙海' },
        { url: 'assets/photos/sahara-3.jpg', cap: '星空 · 营地帐篷' },
      ],
      fragments: [
        { time: '17:00', text: '骆驼队走进沙丘深处，驼铃声被风磨得很钝。' },
        { time: '20:30', text: '柏柏尔人的鼓声停了，沙漠安静得像另一个星球。' },
        { time: '23:40', text: '躺在沙脊上看银河，流星划过三次，许愿都来不及。' },
      ],
    },
    {
      id: 'bali-2024', city: '巴厘岛', latin: 'BALI · UBUD', country: '印度尼西亚',
      coord: [-8.5069, 115.2625], date: '2024-07-09', mood: '治愈', theme: '海岛与海',
      title: '乌布的日子，被雨和稻田泡软', note: '被泡软的日子', zoom: 6,
      photos: [
        { url: 'assets/photos/bali-1.jpg', cap: '德格拉朗 · 梯田' },
        { url: 'assets/photos/bali-2.jpeg', cap: '梯田 · 晨雾俯瞰' },
        { url: 'assets/photos/bali-3.jpg', cap: '海神庙 · 落日' },
      ],
      fragments: [
        { time: '07:00', text: '德格拉朗的梯田晨雾未散，稻田绿得发亮。' },
        { time: '13:20', text: '午后的雨说下就下，躲在凉亭里看雨打芭蕉。' },
        { time: '18:30', text: '金巴兰的落日海鲜烧烤，沙子还带着白天的温度。' },
      ],
    },
    {
      id: 'kamakura-2025', city: '镰仓', latin: 'KAMAKURA', country: '日本',
      coord: [35.3194, 139.5461], labelSide: 'b', date: '2025-04-12', mood: '悸动', theme: '城市漫游',
      title: '江之电穿过樱花，开进十六岁', note: '十六岁的电车', zoom: 6,
      photos: [
        { url: 'assets/photos/kamakura-1.jpg', cap: '江之电 · 501 号' },
        { url: 'assets/photos/kamakura-2.jpg', cap: '湘南海岸 · 冲浪的人' },
        { url: 'assets/photos/kamakura-3.jpg', cap: '海岸 · 富士落日' },
      ],
      fragments: [
        { time: '10:15', text: '镰仓高校前的道口，海在画面尽头，等一列绿皮电车。' },
        { time: '12:40', text: '长谷寺的紫藤开了一半，眺望台能看见整个相模湾。' },
        { time: '16:50', text: '坐在湘南海岸的堤上发呆，风里有青春片的味道。' },
      ],
    },
    {
      id: 'dolomites-2025', city: '多洛米蒂', latin: 'DOLOMITES', country: '意大利',
      coord: [46.5407, 12.1357], labelSide: 't', date: '2025-09-06', mood: '热血', theme: '山野徒步',
      title: '刀锋山脊上，云在脚底下流', note: '腿在抖，心在跳', zoom: 5,
      photos: [
        { url: 'assets/photos/dolomites-1.jpg', cap: '刀锋山 · 红衣行者' },
        { url: 'assets/photos/dolomites-2.jpg', cap: '山径 · 绿甸石峰' },
        { url: 'assets/photos/dolomites-3.jpeg', cap: '垭口 · 晚霞' },
      ],
      fragments: [
        { time: '06:10', text: 'Tre Cime 的晨光把岩壁染成粉金色，冷，但值得。' },
        { time: '11:20', text: '沿着山脊线走，两侧都是千米落差，手心一直在出汗。' },
        { time: '19:30', text: '山屋的苹果卷和热茶，是登山日最后的犒赏。' },
      ],
    },
    {
      id: 'cappadocia-2026', city: '卡帕多奇亚', latin: 'CAPPADOCIA', country: '土耳其',
      coord: [38.6431, 34.8286], date: '2026-03-21', mood: '热血', theme: '沙漠星夜',
      title: '凌晨四点半，为追一只热气球', note: '值得早起的热血', zoom: 5,
      photos: [
        { url: 'assets/photos/cappadocia-1.jpg', cap: '热气球 · 精灵烟囱' },
        { url: 'assets/photos/cappadocia-2.jpg', cap: '河谷 · 徒步' },
      ],
      fragments: [
        { time: '04:30', text: '被闹钟叫醒的瞬间，困意和期待打了个平手。' },
        { time: '06:10', text: '一百只热气球同时升空，卡帕的地貌像被点着了。' },
        { time: '08:00', text: '落地后才知道，今天的「棋盘丘」能见度是全年最佳。' },
      ],
    },
    {
      id: 'roma-2026', city: '罗马', latin: 'ROMA', country: '意大利',
      coord: [41.9028, 12.4964], labelSide: 'b', date: '2026-05-30', mood: '思念', theme: '人文古迹',
      title: '还没离开罗马，就开始想念它', note: '为了再来一次', zoom: 5,
      photos: [
        { url: 'assets/photos/roma-1.jpg', cap: '万神殿 · 落日广场' },
        { url: 'assets/photos/roma-2.jpg', cap: '许愿池 · 夜' },
        { url: 'assets/photos/roma-3.jpg', cap: '特拉斯提弗列 · 小巷' },
      ],
      fragments: [
        { time: '09:00', text: '万神殿的光柱从穹顶落下来，两千年的时间有了形状。' },
        { time: '15:30', text: '在特拉斯提弗列的小巷里迷路，每一条岔路都通向好吃的。' },
        { time: '20:40', text: '把硬币丢进许愿池——为了再来一次。' },
      ],
    },
  ];

  return { entries, moods: MOODS, themeOrder: THEME_ORDER, icons: ICONS };
})();
