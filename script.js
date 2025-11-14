// =======================================================================
// A. GLOBAL TANIMLAR VE AYARLAR
// =======================================================================
var vakaDurumu = { can: 3, sure: 120 }; // Puan kaldırıldı
var timer;

var geoJsonLayer;
var overlayMaps = {};
let averageData = {};
let currentLayer = null;
var borderLayer = null;

// SÜTUN VE DOSYA ADLARI
const GEOJSON_FILE = 'songeojson.geojson';
const COLUMNS = {
    IL_ADI: 'adm1_tr',
    EGITIM: 'EĞİTİMS', // Kırık/Kısaltılmış alan adı
    CEZAEVI: 'cezaevi_field_2',
    YOKSULLUK: 'YOKSULLUKO',
    NUFUS: 'İLLEREGÖ',
    POLIS_MERKEZ: 'polısmerkezı_field_2',
    ALKOL_MEKAN: 'alkolmekan_field_2'
};

// VAKA LİSTESİ (Çoklu Vaka Sistemi)
const caseList = [
    {
        id: "VAKA_01",
        il: "VAN",
        title: '<span style="color: yellow;">VAKA #001: HIRSIZLIK SUÇU</span>',
        narrative:
"<br>Dedektif, şehir genelinde yüksek değerli mülkleri hedef alan organize bir hırsızlık dalgası ortaya çıktı.<br>" +
"Suç mahalleri, sosyal kontrolün zayıf, ekonomik baskının yüksek ve eğitim seviyesinin düşük olduğu noktalarla dikkat çekiyor.<br><br>" +
"GÖREV:<br>" +
"Dedektif, üç kritik risk göstergesinin <br>-Yüksek Cezaevi Çıkışı, <br>-Yüksek Yoksulluk  <br>-Düşük Eğitim   <br> Bu kritik göstergelerin en yoğun şekilde kesiştiği ili tespit ederek," +
"bir sonraki olası suç mahallinin profilini kesinleştirmelidir.<br><br>" +
"Unutma dedektif… Bu vakayı çözebilecek tek kişi sensin.<br>"
    },
    {
        id: "VAKA_02",
        il: "KÜTAHYA",
        title: '<span style="color: yellow;">VAKA #002: CİNAYET SUÇU',
        narrative:
"<br>Dedektif, şimdi bir cinayet davası için sana ihtiyacımız var.<br>" +
"Sonraki cinayet suçlarının;cezaevi çıkışlarının ve alkol tüketiminin yüksek olduğu bölgelerde,<br>" +
"polis kontrolünün ise zayıfladığı alanlarda patlak vermesi bekleniyor.<br><br>" +
"GÖREV:<br>" +
"Dedektif, bu üç risk sinyalinin <br>-Yüksek Cezaevi Çıkışı, <br>-Yüksek Alkollü Mekân Sayısı <br>-Düşük Polis Kontrolü <br>" +
"mantıksal olarak en yoğun olduğu ili tespit ederek, bir sonraki olası suç mahalli profilini doğrulamalıdır.<br><br>" +
"Unutma dedektif… Bu vakayı çözebilecek tek kişi sensin."
    }
];


let currentCaseIndex = 0;
let ANOMALI_IL_ADI = caseList[currentCaseIndex].il;

// Haritayı başlat
var map = L.map('map').setView([39.9, 32.8], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 18
}).addTo(map);

// ------------------------------------------------------------------------
// B. GEOJSON YÜKLEME VE VERİ İŞLEME
// ------------------------------------------------------------------------

function cleanAndParseFloat(value) {
    if (value === null || value === undefined || value.toString().trim() === '') {
        return NaN;
    }
    let cleanedValue = value.toString().trim().replace(',', '.');
    cleanedValue = cleanedValue.replace(/[^0-9.-]/g, '');
    return parseFloat(cleanedValue);
}

function calculateAverages(data) {
    const features = data.features;
    let totals = { 
        [COLUMNS.EGITIM]: 0, [COLUMNS.YOKSULLUK]: 0, [COLUMNS.CEZAEVI]: 0,
        [COLUMNS.POLIS_MERKEZ]: 0, [COLUMNS.ALKOL_MEKAN]: 0 
    };
    const count = features.length;

    features.forEach(feature => {
        const props = feature.properties;
        totals[COLUMNS.EGITIM] += cleanAndParseFloat(props[COLUMNS.EGITIM]) || 0;
        totals[COLUMNS.YOKSULLUK] += cleanAndParseFloat(props[COLUMNS.YOKSULLUK]) || 0;
        totals[COLUMNS.CEZAEVI] += parseInt(props[COLUMNS.CEZAEVI]) || 0; 
        totals[COLUMNS.POLIS_MERKEZ] += parseInt(props[COLUMNS.POLIS_MERKEZ]) || 0;
        totals[COLUMNS.ALKOL_MEKAN] += parseInt(props[COLUMNS.ALKOL_MEKAN]) || 0;
    });

    averageData[COLUMNS.EGITIM] = totals[COLUMNS.EGITIM] / count;
    averageData[COLUMNS.YOKSULLUK] = totals[COLUMNS.YOKSULLUK] / count;
    averageData[COLUMNS.CEZAEVI] = totals[COLUMNS.CEZAEVI] / count;
    averageData[COLUMNS.POLIS_MERKEZ] = totals[COLUMNS.POLIS_MERKEZ] / count;
    averageData[COLUMNS.ALKOL_MEKAN] = totals[COLUMNS.ALKOL_MEKAN] / count;
}

async function fetchAndLoadGeoJSON() {
    try {
        L.DomUtil.get('vaka-metni').innerHTML = "GeoJSON verisi yükleniyor...";
        
        const response = await fetch(GEOJSON_FILE);
        if (!response.ok) {
            throw new Error(`Dosya yüklenemedi: ${response.statusText}. 'songeojson.geojson' dosyasını kontrol edin.`);
        }
        
        const geojsonData = await response.json();
        
        calculateAverages(geojsonData);
        
        loadGeoJsonLayer(geojsonData); 
        L.control.layers(null, overlayMaps, { collapsed: false }).addTo(map);
        
        initGame(); 
        
        if (!sessionStorage.getItem('game_started')) {
            openTutorialModal();
        } else {
            openCaseFile(); 
        }
        
    } catch (error) {
        console.error("KRİTİK HATA: GeoJSON yükleme başarısız!", error);
        L.DomUtil.get('vaka-metni').innerHTML = "KRİTİK HATA: Veri yükleme başarısız! Konsolu kontrol edin.";
    }
}

fetchAndLoadGeoJSON();

// =======================================================================
// C. STİL VE KOROLET FONKSİYONLARI 
// =======================================================================

function getColor(d) { // Eğitim Süresi (YÜKSEK DEĞER = DÜŞÜK RİSK/YEŞİL)
    d = parseFloat(d); 
    return d > 10.5 ? '#1a9850' : d > 9.5 ? '#a6d96a' : d > 8.5 ? '#fee08b' : d > 7.5 ? '#f46d43' : '#d73027'; 
}

function getYoksullukColor(d) { // Yoksulluk Oranı (YÜKSEK DEĞER = YÜKSEK RİSK/KIRMIZI)
    d = parseFloat(d);
    return d > 12 ? '#d73027' : d > 9 ? '#f46d43' : d > 6 ? '#fee08b' : d > 3 ? '#a6d96a' : '#1a9850';
}

function getCezaeviColor(d) { // Cezaevi Çıkışları (YÜKSEK DEĞER = YÜKSEK RİSK/KIRMIZI)
    d = parseInt(d);
    return d > 10000 ? '#d73027' : d > 7500 ? '#f46d43' : d > 5000 ? '#feb24c' : d > 2500 ? '#a6d96a' : '#1a9850';
}

function styleBorders(feature) {
    return { fillColor: 'transparent', color: '#888', weight: 1.5, fillOpacity: 0 };
}

function style(feature) { // Eğitim Süresi Stili (Ana)
    const egitimYili = cleanAndParseFloat(feature.properties[COLUMNS.EGITIM]); 
    if (isNaN(egitimYili)) { return { fillColor: '#888888', weight: 0.1, opacity: 0.1, color: 'transparent', fillOpacity: 0.0, interactive: false }; }
    return { fillColor: getColor(egitimYili), weight: 0.1, opacity: 0.1, color: 'transparent', fillOpacity: 0.7, interactive: false };
}

function styleYoksulluk(feature) { // Yoksulluk Stili
    var yoksullukOrani = cleanAndParseFloat(feature.properties[COLUMNS.YOKSULLUK]);
    return { fillColor: getYoksullukColor(yoksullukOrani), weight: 0.1, opacity: 0.1, color: 'transparent', fillOpacity: 0.7, interactive: false };
}

function styleCezaevi(feature) { // Cezaevi Stili
    var cezaeviSayisi = parseInt(feature.properties[COLUMNS.CEZAEVI]);
    return { fillColor: getCezaeviColor(cezaeviSayisi), weight: 0.1, opacity: 0.1, color: 'transparent', fillOpacity: 0.7, interactive: false };
}

function stylePolisMerkez(feature) { // Polis Merkezi Stili
    var sayi = parseInt(feature.properties[COLUMNS.POLIS_MERKEZ]);
    return { fillColor: getPolisMerkezColor(sayi), weight: 0.1, opacity: 0.1, color: 'transparent', fillOpacity: 0.7, interactive: false };
}

function styleAlkolMekan(feature) { // Alkol Mekanı Stili
    var sayi = parseInt(feature.properties[COLUMNS.ALKOL_MEKAN]);
    return { fillColor: getAlkolMekanColor(sayi), weight: 0.1, opacity: 0.1, color: 'transparent', fillOpacity: 0.7, interactive: false };
}

function getPolisMerkezColor(d) {
    d = parseInt(d);
    return d > 100 ? '#1a9850' : d > 50 ? '#a6d96a' : d > 20 ? '#fee08b' : '#f46d43';
}

function getAlkolMekanColor(d) {
    d = parseInt(d);
    return d > 500 ? '#d73027' : d > 200 ? '#f46d43' : d > 50 ? '#fee08b' : '#a6d96a';
}


function loadGeoJsonLayer(data) {
    // 1. SABİT SINIR KATMANINI OLUŞTUR (Mouseover ve Tıklamayı yönetir)
    borderLayer = L.geoJson(data, { 
        style: styleBorders,
        onEachFeature: function(feature, layer) {
            layer.on({
                mouseover: function(e) {
                    e.target.setStyle({ color: '#00FFFF', weight: 3 }); 
                    updateClueCards(feature.properties); 
                    L.DomUtil.get('vaka-metni').innerHTML = 'KANIT YÜKLENİYOR: ' + feature.properties[COLUMNS.IL_ADI]; 
                },
                mouseout: function(e) {
                    borderLayer.resetStyle(e.target); 
                    L.DomUtil.get('vaka-metni').innerHTML = 
                        `<a onclick="openCaseFile()" style="color: inherit; text-decoration: none;">VAKA DOSYASINI İNCELEMEK İÇİN TIKLAYINIZ</a>`;
                },
                click: function(e) { 
                    checkPrediction(e);
                    showRawDataModal(e.target.feature.properties); 
                }
            });
        }
    }).addTo(map);

    // 2. DİNAMİK VERİ KATMANLARINI OLUŞTUR (Sadece renklendirme için)
    geoJsonLayer = L.geoJson(data, { style: style, interactive: false });
    var yoksullukLayer = L.geoJson(data, { style: styleYoksulluk, interactive: false });
    var cezaeviLayer = L.geoJson(data, { style: styleCezaevi, interactive: false });
    var polisLayer = L.geoJson(data, { style: stylePolisMerkez, interactive: false });
    var alkolLayer = L.geoJson(data, { style: styleAlkolMekan, interactive: false });
    
    // Menüye ekle
    overlayMaps["Eğitim Risk Skoru (Ana)"] = geoJsonLayer;
    overlayMaps["Kanıt: Yoksulluk Oranı"] = yoksullukLayer;
    overlayMaps["Kanıt: Cezaevi Çıkışları"] = cezaeviLayer;
    overlayMaps["Kontrol: Polis Merkezi Sayısı"] = polisLayer;
    overlayMaps["Kontrol: Alkol Mekanları Sayısı"] = alkolLayer;

    var bounds = geoJsonLayer.getBounds();
    if (bounds.isValid()) { map.fitBounds(bounds); }
}

function switchMapLayer(layerName) {
    const cardElement = document.getElementById(`kart-${(layerName === 'EGITIM') ? 1 : (layerName === 'CEZAEVI') ? 2 : 3}`);
    
    if (currentLayer) { map.removeLayer(currentLayer); }
    
    let newLayer;
    
    // 🚨 KRİTİK GÜNCELLEME: VAKA BAZINDA KATMAN ATAMASI
    if (currentCaseIndex === 0) { // VAKA 1 (Hırsızlık): Eğitim, Cezaevi, Yoksulluk
        if (layerName === 'EGITIM') {
            newLayer = overlayMaps["Eğitim Risk Skoru (Ana)"];
        } else if (layerName === 'CEZAEVI') {
            newLayer = overlayMaps["Kanıt: Cezaevi Çıkışları"];
        } else if (layerName === 'YOKSULLUK') {
            newLayer = overlayMaps["Kanıt: Yoksulluk Oranı"];
        }
    } else if (currentCaseIndex === 1) { // VAKA 2 (Cinayet): Cezaevi, Polis, Alkol
        if (layerName === 'EGITIM') {
            newLayer = overlayMaps["Kanıt: Cezaevi Çıkışları"]; 
        } else if (layerName === 'CEZAEVI') {
            newLayer = overlayMaps["Kontrol: Polis Merkezi Sayısı"]; 
        } else if (layerName === 'YOKSULLUK') {
            newLayer = overlayMaps["Kontrol: Alkol Mekanları Sayısı"];
        }
    }

    if (newLayer) {
        newLayer.addTo(map); 
        currentLayer = newLayer; 
        
        document.querySelectorAll('.ipucu-kartlari').forEach(card => card.classList.remove('active'));
        cardElement.classList.add('active');
    }
}

// =======================================================================
// D. OYUN YÖNETİMİ VE MODAL FONKSİYONLARI (GÜNCELLENDİ)
// =======================================================================

function openTutorialModal() {
    sessionStorage.setItem('game_started', 'true');
    document.getElementById('tutorial-modal').style.display = 'block';
}

function closeTutorialModal() {
    document.getElementById('tutorial-modal').style.display = 'none';
    openCaseFile(); 
}

function openCaseFile() {
    document.getElementById('case-modal').style.display = 'block';
    const currentCase = caseList[currentCaseIndex]; 
    
    document.getElementById('case-title').innerHTML = currentCase.title;
    document.getElementById('case-narrative').innerHTML = currentCase.narrative;
    
    clearInterval(timer); 
}

function closeCaseFile() {
    document.getElementById('case-modal').style.display = 'none';
    startTimer(); 
}

function initGame() {
    // L.DomUtil.get('puan').innerHTML = vakaDurumu.puan; // Puan kaldırıldı
    L.DomUtil.get('can').innerHTML = vakaDurumu.can;
    L.DomUtil.get('sure').innerHTML = vakaDurumu.sure;

    L.DomUtil.get('vaka-metni').innerHTML = 
        `<a onclick="openCaseFile()" style="color: inherit; text-decoration: none;">VAKA DOSYASINI İNCELEMEK İÇİN TIKLAYINIZ</a>`;
    
    document.querySelectorAll('.ipucu-kartlari').forEach(card => card.classList.remove('active'));
}

// Yeni: Oyunun Bittiği Durum (Can bitti)
function handleGameOver() {
    clearInterval(timer);
    if (borderLayer) {
         borderLayer.eachLayer(layer => layer.off('click')); 
         borderLayer.eachLayer(layer => layer.off('mouseover')); 
         borderLayer.eachLayer(layer => layer.off('mouseout')); 
    }
    if (currentLayer) { map.removeLayer(currentLayer); currentLayer = null; }
    L.DomUtil.get('can').innerHTML = 0; 
    L.DomUtil.get('vaka-metni').innerHTML = 
        `<a onclick="window.location.reload()" style="color: red; text-decoration: underline; cursor: pointer; font-size: 1.2em;">
             BAŞARISIZ. YENİ BİR MİSYON BAŞLATMAK İÇİN TIKLAYINIZ.
        </a>`;
}

// Yeni: Başarılı Vaka Çözümünde Sonraki Vakaya Geçiş
function handleCaseSuccess() {
    currentCaseIndex++;
    
    if (currentCaseIndex < caseList.length) {
        const nextCase = caseList[currentCaseIndex];
        ANOMALI_IL_ADI = nextCase.il; 

        showToast(`SİSTEM GÜNCELLEDİ: VAKA ${nextCase.id} YÜKLENİYOR...`, 'success', 2500); 

        if (currentLayer) { map.removeLayer(currentLayer); currentLayer = null; }
        if (borderLayer) borderLayer.eachLayer(l => l.setStyle(styleBorders(l.feature))); 
        document.querySelectorAll('.ipucu-kartlari').forEach(card => card.classList.remove('active'));
        
        // Vaka 2'ye özel kart başlık güncellemesi
        if (currentCaseIndex === 1) { 
             document.getElementById('kart-1').querySelector('.kart-baslik').innerHTML = "Kanıt 1: Cezaevi çıkışları";
             document.getElementById('kart-2').querySelector('.kart-baslik').innerHTML = "Kanıt 2: Polis Merkezi Sayısı"; 
             document.getElementById('kart-3').querySelector('.kart-baslik').innerHTML = "Kanıt 3: Alkol Mekanları Sayısı";

             document.getElementById('ipucu-egitim').innerHTML = 'Veri Bekleniyor...';
             document.getElementById('ipucu-cezaevi').innerHTML = 'Veri Bekleniyor...';
             document.getElementById('ipucu-yoksulluk').innerHTML = 'Veri Bekleniyor...';
        }

        L.DomUtil.get('can').innerHTML = vakaDurumu.can;
        vakaDurumu.sure = 120; // Yeni vaka için süreyi sıfırla
        L.DomUtil.get('vaka-metni').innerHTML = 
            `<a onclick="openCaseFile()" style="color: inherit; text-decoration: none;">VAKA ${nextCase.id} BAŞLATILDI. TIKLAYINIZ.</a>`;
        
        setTimeout(() => { 
            openCaseFile(); 
        }, 2000); 

    } else {
        // TÜM VAKALAR ÇÖZÜLDÜ (ZAFER)
        showToast(`TEBRİKLER! TÜM VAKALAR ÇÖZÜLDÜ.`, 'success', 8000); 
        if (borderLayer) borderLayer.eachLayer(layer => layer.off('click')); 
    }
}


function startTimer() {
    clearInterval(timer); 
    timer = setInterval(() => {
        vakaDurumu.sure--;
        L.DomUtil.get('sure').innerHTML = vakaDurumu.sure; 
        if (vakaDurumu.sure <= 0) { 
            clearInterval(timer); 
            
            vakaDurumu.can -= 1; // Can azalır
            L.DomUtil.get('can').innerHTML = vakaDurumu.can; // Canı hemen güncelle

            if (vakaDurumu.can > 0) {
                // Başarısızlık: Aynı vakayı yeniden yükle
                showToast(`SÜRE BİTTİ! VAKA BAŞARISIZ OLDU. Can (-1). Aynı görev yeniden başlatılıyor.`, 'error', 5000);
                setTimeout(() => {
                    vakaDurumu.sure = 120; // Süreyi sıfırla
                    L.DomUtil.get('sure').innerHTML = vakaDurumu.sure;
                    // Harita sınır stillerini sıfırla
                    if (borderLayer) borderLayer.eachLayer(l => l.setStyle(styleBorders(l.feature))); 
                    openCaseFile(); // Vaka dosyasını aç (bu, closeCaseFile ile yeni timer başlatır)
                }, 3000);
            } else {
                // Game Over
                showToast(`SÜRE BİTTİ! GÖREV İPTAL! Canınız kalmadı.`, 'error', 5000);
                handleGameOver();
            }
        }
    }, 1000); 
}

// Eski resetVaka fonksiyonu tamamen kaldırıldı ve mantığı handleCaseSuccess/handleGameOver fonksiyonlarına bölündü.


// =======================================================================
// E. ETKİLEŞİM VE İPUCU KARTLARI (GÜNCELLENDİ)
// =======================================================================

function showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toast-container');
    
    if (!container) { console.error("HATA: #toast-container bulunamadı!"); return; }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => { toast.classList.add('show'); }, 10); 

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 300); 
    }, duration);
}

function showRawDataModal(properties) {
    document.getElementById('raw-data-modal').style.display = 'block';
    
    // 1. Veri Doldurma
    document.getElementById('data-il-adi').innerHTML = `Ham Veri Dosyası: ${properties[COLUMNS.IL_ADI]}`;
    
    // Temel Dört Veri
    document.getElementById('raw-nufus').innerHTML = properties[COLUMNS.NUFUS] ? parseInt(properties[COLUMNS.NUFUS]).toLocaleString() : 'N/A';
    document.getElementById('raw-egitim').innerHTML = properties[COLUMNS.EGITIM] ? cleanAndParseFloat(properties[COLUMNS.EGITIM]).toFixed(1) + ' Yıl' : 'N/A';
    document.getElementById('raw-cezaevi').innerHTML = properties[COLUMNS.CEZAEVI] ? parseInt(properties[COLUMNS.CEZAEVI]).toLocaleString() + ' Kişi' : 'N/A';
    document.getElementById('raw-yoksulluk').innerHTML = properties[COLUMNS.YOKSULLUK] ? cleanAndParseFloat(properties[COLUMNS.YOKSULLUK]).toFixed(2) + ' %' : 'N/A';

    // 🚨 YENİ EKLENEN İKİ ALAN (POLIS ve ALKOL)
    document.getElementById('raw-polis').innerHTML = properties[COLUMNS.POLIS_MERKEZ] ? parseInt(properties[COLUMNS.POLIS_MERKEZ]).toLocaleString() : 'N/A';
    document.getElementById('raw-alkol').innerHTML = properties[COLUMNS.ALKOL_MEKAN] ? parseInt(properties[COLUMNS.ALKOL_MEKAN]).toLocaleString() : 'N/A';
}

function closeRawDataModal() {
    document.getElementById('raw-data-modal').style.display = 'none';
}

function checkPrediction(e) {
    var clickedArea = e.target.feature.properties;
    clearInterval(timer); 
    
    if (clickedArea[COLUMNS.IL_ADI] === ANOMALI_IL_ADI) { 
        // Başarılı Tahmin
        
        e.target.setStyle({ weight: 5, color: '#00FF00', fillOpacity: 1 }); 
        showToast(`VAKA ÇÖZÜMLENDİ! ${ANOMALI_IL_ADI} doğru il.`, 'success', 3000);
        
        // Başarılı çözümde bir sonraki vakaya geçer
        setTimeout(() => handleCaseSuccess(), 3000); // 🚨 Yeni fonksiyon çağrısı
    } else {
        // Hatalı Tahmin
        vakaDurumu.can -= 1; // Can azalır
        
        e.target.setStyle({ fillColor: '#FF0000', color: 'red', weight: 4 }); 
        showToast(`HATALI TAHMİN! Can (-1).`, 'error', 3000);
        
        L.DomUtil.get('can').innerHTML = vakaDurumu.can;
        
        if (vakaDurumu.can > 0) { 
             // Can varsa aynı vakayı yeniden denemek için hazırlık yap
             setTimeout(() => {
                e.target.setStyle(styleBorders(e.target.feature)); // Hata stilini sıfırla
                closeRawDataModal(); // Ham veri modalını kapat
                startTimer(); // Timer'ı yeniden başlat
             }, 3000);
        } else { 
            handleGameOver(); // Game Over
        }
    }
    
    showRawDataModal(clickedArea); 
}

function updateClueCards(properties) {
    const egitimVal = cleanAndParseFloat(properties[COLUMNS.EGITIM]);
    const cezaeviVal = parseInt(properties[COLUMNS.CEZAEVI]) || 0;
    const yoksullukVal = cleanAndParseFloat(properties[COLUMNS.YOKSULLUK]);
    
    const egitimHint = egitimVal > averageData[COLUMNS.EGITIM] ? 
        `Üstünde (${egitimVal.toFixed(1)} Yıl) - RİSK DÜŞÜK` : 
        `Altında (${egitimVal.toFixed(1)} Yıl) - RİSK YÜKSEK`;

    const cezaeviHint = cezaeviVal > averageData[COLUMNS.CEZAEVI] ?
        `Yüksek Profil (${cezaeviVal.toLocaleString()} Kişi) - KRİTİK RİSK` :
        `Düşük Profil (${cezaeviVal.toLocaleString()} Kişi) - TAKİP NORMAL`;
        
    const yoksullukHint = yoksullukVal > averageData[COLUMNS.YOKSULLUK] ?
        `Üstünde (%${yoksullukVal.toFixed(1)}) - FİNANSAL ZORLUK` :
        `Altında (%${yoksullukVal.toFixed(1)}) - FİNANSAL GÜVENDE`;

    // KART İÇERİKLERİNİN VAKA BAZINDA GÜNCELLEMESİ
    if (currentCaseIndex === 0) { // VAKA 1: Hırsızlık
        L.DomUtil.get('ipucu-egitim').innerHTML = isNaN(egitimVal) ? 'VERİ HATALI' : `Eğitim: ${egitimHint}`;
        L.DomUtil.get('ipucu-cezaevi').innerHTML = cezaeviHint;
        L.DomUtil.get('ipucu-yoksulluk').innerHTML = isNaN(yoksullukVal) ? 'VERİ HATALI' : yoksullukHint;
        
    } else if (currentCaseIndex === 1) { // VAKA 2: Cinayet (Yeni verilerle)
        const polisVal = parseInt(properties[COLUMNS.POLIS_MERKEZ]) || 0;
        const alkolVal = parseInt(properties[COLUMNS.ALKOL_MEKAN]) || 0;
        const nufusVal = parseInt(properties[COLUMNS.NUFUS]) || 0;

        const polisHint = polisVal > averageData[COLUMNS.POLIS_MERKEZ] ?
            `Polis: YÜKSEK Kontrol (${polisVal})` :
            `Polis: DÜŞÜK Kontrol (${polisVal}) - KRİTİK EKSİKLİK`;
            
        const alkolHint = alkolVal > averageData[COLUMNS.ALKOL_MEKAN] ?
            `Alkol: YÜKSEK Yoğunluk (${alkolVal}) - STRES YÜKSEK` :
            `Alkol: DÜŞÜK Yoğunluk (${alkolVal}) - STRES NORMAL`;

        // Kart 1 (Şimdi Cezaevi Çıkışları)
        L.DomUtil.get('ipucu-egitim').innerHTML = isNaN(egitimVal) ? 'VERİ HATALI' : `${cezaeviHint} <br> `;
        // Kart 2 (Şimdi Polis Merkezi Sayısı)
        L.DomUtil.get('ipucu-cezaevi').innerHTML = ` ${polisHint}<br>`;
        // Kart 3 (Şimdi Alkol Mekanları Sayısı)
        L.DomUtil.get('ipucu-yoksulluk').innerHTML = isNaN(yoksullukVal) ? 'VERİ HATALI' : ` ${alkolHint}<br>`;
    }
}