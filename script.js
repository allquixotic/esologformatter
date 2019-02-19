/*
Copyright 2019 Sean McNamara <smcnam@gmail.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

var fileHolder = [];
var outputList = null;
var allLines = [];
var channels = {};
const linerx = new RegExp(/^((\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})-(\d{2}):(\d{2})) (\d{1,2}),([^,]+),(.*)$/, "gmi");

//As of API 100025 (Murkmire/v4.2)
const minChannel = 0;
const maxChannel = 35;
const chatChannels = {
  0 : "Say",
  1 : "Yell",
  2 : "Whisper",
  3 : "Group",
  4 : "Outgoing Whisper",
  5 : "Unused 1",
  6 : "Emote",
  7 : "NPC Say",
  8 : "NPC Yell",
  9 : "NPC Whisper",
  10 : "NPC Emote",
  11 : "System",
  12 : "Guild 1",
  13 : "Guild 2",
  14 : "Guild 3",
  15 : "Guild 4",
  16 : "Guild 5",
  17 : "Officer 1",
  18 : "Officer 2",
  19 : "Officer 3",
  20 : "Officer 4",
  21 : "Officer 5",
  22 : "Custom 1",
  23 : "Custom 2",
  24 : "Custom 3",
  25 : "Custom 4",
  26 : "Custom 5",
  27 : "Custom 6",
  28 : "Custom 7",
  29 : "Custom 8",
  30 : "Custom 9",
  31 : "Zone",
  32 : "Zone Intl 1",
  33 : "Zone Intl 2",
  34 : "Zone Intl 3",
  35 : "Zone Intl 4"
};
const chatChannelLabels = $.extend({}, chatChannels);

const readUploadedFileAsText = (inputFile) => {
  const temporaryFileReader = new FileReader();

  return new Promise((resolve, reject) => {
    temporaryFileReader.onerror = () => {
      temporaryFileReader.abort();
      reject(new DOMException("Problem parsing input file."));
    };

    temporaryFileReader.onload = () => {
      resolve(temporaryFileReader.result);
    };
    temporaryFileReader.readAsText(inputFile);
  });
};

function chatChannelsRev() {
  let tmp = {}; 
  Object.keys(chatChannels).forEach((ez) => tmp[chatChannels[ez]] = ez); 
  return tmp; 
}

function createOutputList() {
  let ul = document.createElement("ul");
  ul.id = "outputList";
  return ul;
}

function getChannelNameFromId(elemen) {
  return elemen.id.match(/\d+$/)[0];
}

function getDropListItems() {
  let retval = [];
  Object.keys(chatChannelsRev()).forEach((elt) => {
    let itm = document.createElement("option");
    itm.value = elt;
    itm.textContent = elt;
    retval.push(itm);
  });
  return retval;
}

function channelNameChange(element) { 
  let channelNum = getChannelNameFromId(element);
  let custText = document.getElementById(`channelCustText${channelNum}`).value;
  if(custText == null || custText.trim() == "") {
    chatChannelLabels[channelNum] = element.value;
  }
  else {
    chatChannelLabels[channelNum] = custText;
  }
  
  recalcExamples();
}

function channelNameDropdownChange() {
  channelNameChange(this);
}

function timeFormatChange() {
  recalcExamples();
}

function outputFormatChange() {
  recalcExamples();
}

function sortTimeChange() {
  //recalcExamples();
}

function recalcExamples() {
  document.getElementsByName("exampleTextTd").forEach((ett) => {
    let channelNum = getChannelNameFromId(ett);
    let resultList = channels[channelNum];
    ett = removeAllChildren(ett);
    ett.appendChild(renderResultList(resultList, channelNum, 6))
  });
}

function createFormField(tag, nameBase, channelNum) {
  let fld = document.createElement(tag);
  fld.id = `${nameBase}${channelNum}`;
  fld.className = "form-control match-content";
  return fld;
}

function createCustField(channelNum) {
  let div = document.createElement("div");
  div.id = `divChannelCustText${channelNum}`;
  div.innerHTML = `
    <label for="channelCustText${channelNum}">Alias/Abbrev.</label>
    <input type="text" id="channelCustText${channelNum}" class="form-control match-content">
  `.trim();
  return div;
}

function getTimeHeader() {
  if(document.getElementById("timeformat").value == "none") {
    return "";
  }
  return "<td>Time</td>";
}

function getTimeValue(origTimeString) {
  if(document.getElementById("timeformat").value == "none") {
    return "";
  }
  if(document.getElementById("timeformat").value == "friendly") {
    return luxon.DateTime.fromISO(origTimeString, {setZone: true}).setLocale('en-us').toFormat("LL/dd/yy hh:mm:ssa ZZZZ");
  }
  else if(document.getElementById("timeformat").value == "friendlynotz") {
    return luxon.DateTime.fromISO(origTimeString, {setZone: true}).setLocale('en-us').toFormat("LL/dd/yy hh:mm:ssa");
  }
  else if(document.getElementById("timeformat").value == "minfriendly") {
    return luxon.DateTime.fromISO(origTimeString, {setZone: true}).setLocale('en-us').toFormat("L/d/yy h:mm:ssa");
  }
  else if(document.getElementById("timeformat").value == "european") {
    return luxon.DateTime.fromISO(origTimeString, {setZone: true}).setLocale('en-us').toFormat("dd/LL/yy HH:mm:ss ZZZZ");
  }
  return origTimeString; 
}

function getTimeCell(origTimeString) {
  if(document.getElementById("timeformat").value == "none") {
    return "";
  }
  return `<td>${getTimeValue(origTimeString)}</td>`;
}

function renderResultList(resultList, channelNum, howMany = null, prefix = "example") {
  if(channelNum == null) channelNum = "";
  let retval = document.createElement("div");
  retval.style = "word-wrap: break-word;";
  if(document.getElementById("outputformat").value == "table") {
    retval.innerHTML = `
      <table id="${prefix}TextTable${channelNum}" class="table table-bordered table-sm">
        <thead class='thead-light'>
          <tr>
            ${getTimeHeader()}
            <td>Channel</td>
            <td>From</td>
            <td>Message</td>
          </tr>
        </thead>
        <tbody id='${prefix}TextTbody${channelNum}'>
        </tbody>
      </table>
    `.trim();
    let tbody = retval.querySelector(`#${prefix}TextTbody${channelNum}`);
    for(let i = 0; (howMany == null || i < Number(howMany)) && i < resultList.length; i++) {
      if((channelNum != null && channelNum != "") || document.getElementById(`useChannelCheck${resultList[i][11]}`).checked) {
        let row = document.createElement("tr");
        row.innerHTML = `
          ${getTimeCell(resultList[i][1])}
          <td>${chatChannelLabels[resultList[i][11]]}</td>
          <td>${resultList[i][12]}</td>
          <td style="word-wrap: break-word;">${resultList[i][13]}</td>
        `.trim();
        tbody.appendChild(row);
      }
    }
  }
  else {
    let tc = "";
    for(let i = 0; (howMany == null || i < Number(howMany)) && i < resultList.length; i++) {
      if((channelNum != null && channelNum != "") || document.getElementById(`useChannelCheck${resultList[i][11]}`).checked) {
        let tv = getTimeValue(resultList[i][1]);
        if(tv != null && tv != "") tc += "[" + tv + "] ";
        let cc = chatChannels[resultList[i][11]];
        if(cc == "Say") {
          tc += resultList[i][12] + ": ";
        }
        else if(cc == "Emote") {
          tc += resultList[i][12] + " ";
        }
        else if(cc == "Yell") {
          tc += resultList[i][12] + " yells ";
        }
        else if(cc == "Whisper") {
          tc += resultList[i][12] + ": "
        }
        else if(cc == "Outgoing Whisper") {
          tc += "-> " + resultList[i][12] + ": "
        }
        else {
          tc += "[" + chatChannelLabels[resultList[i][11]] + "] " + resultList[i][12] + ": ";
        }
        tc += resultList[i][13];
        tc += "<br>";
      }
    }
    retval.innerHTML = tc;
  }
  return retval;
}

function getTableRow(channelNum, resultList) {
  let tr = document.createElement("tr");
  tr.id = `channelRow${channelNum}`;

  tr.innerHTML = `
    <td style="display: table-cell;" id="useChannelTd${channelNum}">
      <input type="checkbox" id="useChannelCheck${channelNum}" name="useChannelCheck" checked class="form-control match-content">
    </td>
    <td style="display: table-cell;" id="channelNameTd${channelNum}">
      <select id="channelTypeSelect${channelNum}" name="channelTypeSelect" class="form-control match-content">
      </select>
      <div id="divChannelCustText${channelNum}" name="divChannelCustText">
        <br>
        <label for="channelCustText${channelNum}">Alias/Abbrev.</label>
        <input type="text" id="channelCustText${channelNum}" name="channelCustText" class="form-control match-content">
      </div>
    </td>
    <td style="display: table-cell;" id="channelNumTd${channelNum} name="channelNumTd">
      ${channelNum}
    </td>
    <td style="display: table-cell;" id="exampleTextTd${channelNum}" name="exampleTextTd" style="word-wrap: break-word;">
    </td>
  `.trim();

  let dd = tr.querySelector(`#channelTypeSelect${channelNum}`);
  let dli = getDropListItems();
  dli.forEach((di) => {
    dd.appendChild(di);
  });
  dd.value = chatChannels[channelNum];
  dd.onchange = channelNameDropdownChange;

  tr.querySelector(`#exampleTextTd${channelNum}`).appendChild(renderResultList(resultList, channelNum, 6));

  return tr;
}

async function handleFileSelect(evt) {
  let files = evt.target.files;
  outputList = createOutputList();
  for (let i = 0, f; f = files[i]; i++) {
    await processFile(f);
  }
  runStepTwo();
}

async function handleDrop(evt) {
  evt.stopPropagation();
  evt.preventDefault();
  this.className = 'upload-drop-zone';
  outputList = createOutputList();
  let file = null;
  if (evt.dataTransfer.items) {
    for (let i = 0; i < evt.dataTransfer.items.length; i++) {
      if (evt.dataTransfer.items[i].kind === 'file') {
        file = evt.dataTransfer.items[i].getAsFile();
        processFile(file);
      }
    }
  } 
  else {
    for (let i = 0; i < ev.dataTransfer.files.length; i++) {
      file = ev.dataTransfer.files[i];
      await processFile(file);
    }
  } 
  runStepTwo();
}

async function processFile(f) {
  let listItem = document.createElement('li');
  listItem.textContent = f.name;
  outputList.appendChild(listItem);
  let fileText = await readUploadedFileAsText(f);
  let ff = { fileName: f.name, text: fileText.replace(/\r\n/g, "\n") };
  fileHolder.push(ff);
}

function dbg(txt) {
  document.getElementById("debug").innerHTML += txt + "<br>";
}

function sortLinesByTimestamp(lins) {
  lins.sort(function(a, b) {
    return (a[1] < b[1]) ? -1 : ((a[1] > b[1]) ? 1 : 0);
  });
}

function runStepTwo() {
  document.getElementById('list').appendChild(outputList);
  document.getElementById('step2').style.display = 'inline';
  document.getElementById('step1').style.display = 'none';
  fileHolder.forEach((fil) => {
    let result;
    while(result = linerx.exec(fil.text)) {
      let listItem = document.createElement('li');
      let n11 = Number(result[11]);
      if(!channels[n11]) {
        channels[n11] = [];
      }
      channels[n11].push(result);
      allLines.push(result);
    }
  
    let tabl = document.getElementById('channelTable');
    Object.keys(channels).forEach(function(key,index) {
      tabl.appendChild(getTableRow(key, channels[key]));
    });
    $(tabl).on('input', 'input[name=channelCustText]', (e) => { 
      channelNameChange(e.target);
    })
  });
}

function doGenerate() {
  ["step1", "list", "step2", "debug"].forEach((e) => document.getElementById(e).style.display = "none");
  let fr = document.getElementById("finalRender");
  fr.appendChild(renderResultList(allLines, null, null, "final"));
  fr.style.display = "inline";
}

function removeAllChildren(node) {
  var cNode = node.cloneNode(false);
  node.parentNode.replaceChild(cNode ,node);
  return cNode;
}

function handleDragOver(evt) {
  evt.stopPropagation();
  evt.preventDefault();
  evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
  this.className = 'upload-drop-zone drop';
  return false;
}

function handleDragLeave(evt) {
  this.className = 'upload-drop-zone';
  return false;
}

document.getElementById('drop-zone').addEventListener('dragover', handleDragOver, false);
document.getElementById('drop-zone').addEventListener('dragleave', handleDragLeave, false);
document.getElementById('drop-zone').addEventListener('drop', handleDrop, false);
document.getElementById('customFile').addEventListener('change', handleFileSelect, false);