// const buttonaddlavicka = document.querySelector("#addlavicka");
var mapclick = false;

// function addlavicka(){
//     mapclick = true;
//     alert("Klikněte na požadovanou lokaci");
// }

// buttonaddlavicka.addEventListener('click', addlavicka);

var map = L.map('map').setView([50.0917747, 14.4182819], 13);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    // maxBounds...
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

fetch("/lavicky")
    .then (response => response.json())
    .then (data => {
        data.forEach(item => {
            let name = item.Name
            let lat = item.Lat;
            let lng = item.Lng
            var marker = L.marker([lat, lng]).addTo(map);
            marker.bindTooltip(name, {
                direction: "bottom",
                offset: [-15, 30]
            });
        });
    })
    .catch(error => {
        console.error(error);
    });

function setPin(e) {
    if(mapclick){
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/latlng", true);
        xhr.setRequestHeader("Content-Type", "application/json");

        let name = prompt("Název lavičky:");

        var marker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(map);
        marker.bindTooltip(name, {
            direction: "bottom",
            offset: [-15, 30]
        })

        let data = {
            name: name,
            lat: e.latlng.lat,
            lng: e.latlng.lng
        };

        xhr.send(JSON.stringify(data));
        mapclick = false;
    }
}

map.on('click', setPin);

    // var popup = L.popup();

// function onMapClick(e) {
//     popup
//         .setLatLng(e.latlng)
//         .setContent("You clicked the map at " + e.latlng.toString())
//         .openOn(map);
// }

// map.on('click', onMapClick);