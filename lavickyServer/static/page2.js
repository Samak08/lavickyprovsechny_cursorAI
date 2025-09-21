const buttonaddlavicka = document.querySelector("#addlavicka");
var mapclick = false;

function addlavicka(){
    mapclick = true;
    alert("Klikněte na požadovanou lokaci");
}

buttonaddlavicka.addEventListener('click', addlavicka);

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
            let photoPath = item.PhotoPath;
            let benchId = item.id;
            
            var marker = L.marker([lat, lng]).addTo(map);
            
            // Create popup content with photo if available
            let popupContent = `<strong>${name}</strong>`;
            if (photoPath) {
                popupContent += `<br><img src="/${photoPath}" style="max-width: 200px; max-height: 150px; margin-top: 10px;" alt="Bench photo">`;
            }
            popupContent += `<br><button onclick="uploadPhoto(${benchId})" style="margin-top: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer;">Add Photo</button>`;
            
            marker.bindPopup(popupContent, {
                maxWidth: 300,
                className: 'bench-popup'
            });
            marker.bindTooltip(name, {
                direction: "bottom",
                offset: [-15, 30]
            });
            
            // Add click event to open popup
            marker.on('click', function() {
                this.openPopup();
            });
        });
    })
    .catch(error => {
        console.error("Error fetching benches:", error);
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

// Photo upload function
function uploadPhoto(benchId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (file) {
            const formData = new FormData();
            formData.append('photo', file);
            formData.append('benchId', benchId);
            
            fetch('/uploadPhoto', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Photo uploaded successfully!');
                    // Reload the page to show the new photo
                    location.reload();
                } else {
                    alert('Photo upload failed');
                }
            })
            .catch(error => {
                console.error('Upload error:', error);
                alert('Photo upload failed');
            });
        }
    };
    input.click();
}

    // var popup = L.popup();

// function onMapClick(e) {
//     popup
//         .setLatLng(e.latlng)
//         .setContent("You clicked the map at " + e.latlng.toString())
//         .openOn(map);
// }

// map.on('click', onMapClick);