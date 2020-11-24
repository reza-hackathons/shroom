import { createDefinition, publishSchema } from "@ceramicstudio/idx-tools"
import type { JWE } from "did-jwt"
import type { DID } from "dids"
import { SkynetClient, genKeyPairFromSeed } from "skynet-js"
// @ts-ignore
import { fromString, toString } from "uint8arrays"

import { createCeramic } from "./ceramic"
import { createIDX } from "./idx"
import { getAuthProvider } from "./wallet"

const bip39 = require("bip39-light")
const png = require("project-name-generator")

const queryString = require('query-string')

window.genKeyPairFromSeed = genKeyPairFromSeed
window.skynet = new SkynetClient("https://siasky.net")

const userRepoKey = "trips"
const appRepoKey = "public_trips"
const appKeyPair = genKeyPairFromSeed("shroom acid ludes viagra ketamine weed speed cocaine heroin mda opium")

const public_trip_name_separator = "---"

let app = {
  "saved": true,
  "current_trip": {}
}

declare global {
  interface Window {
    did?: DID
    genKeyPairFromSeed: typeof genKeyPairFromSeed
    skynet: SkynetClient
    createKeyPair: any
    loadKeyPair: any
  }
}

const ceramicPromise = createCeramic()

const SkyDBSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "SkyDB",
  type: "object",
}

const authenticate = async (): Promise<void> => {
  console.log("Authenticating...")

  const [authProvider, ceramic] = await Promise.all([getAuthProvider(), ceramicPromise])
  const idx = await createIDX(ceramic, { authProvider })

  // const ceramic = await ceramicPromise
  // const wallet = await Wallet.create({
  //   ceramic,
  //   seed: fromString("5608217256c8920568c7d44a27486411e5559e58f3017c41f39e3ce69ef2f728"),
  //   getPermission() {
  //     return Promise.resolve([])
  //   },
  // })
  // const idx = await createIDX(ceramic, { provider: wallet.getDidProvider() })

  window.did = idx.did
  console.log("Authenticated with DID:", idx.id)

  console.log("Creating IDX setup...")
  // @ts-ignore
  const schemaID = await publishSchema(ceramic, { content: SkyDBSchema })
  const definitionID = await createDefinition(ceramic, {
    name: "SkyDB",
    description: "SkyDB seed",
    schema: schemaID.toUrl("base36"),
  })
  const seedKey = definitionID.toString()
  console.log("IDX setup created with definition ID:", seedKey)

  const createKeyPair = async (seed: string): Promise<ReturnType<typeof genKeyPairFromSeed>> => {
    const jwe = await idx.did.createJWE(fromString(seed), [idx.id])
    await idx.set(seedKey, jwe)
    return genKeyPairFromSeed(seed)
  }
  // @ts-ignore
  window.createKeyPair = createKeyPair

  const loadKeyPair = async (): Promise<ReturnType<typeof genKeyPairFromSeed> | null> => {
    const jwe = await idx.get<JWE>(seedKey)
    if (jwe == null) {
      return null
    }
    const decrypted = await idx.did.decryptJWE(jwe)
    return genKeyPairFromSeed(toString(decrypted))
  }
  // @ts-ignore
  window.loadKeyPair = loadKeyPair  
//   console.log("Next steps:")
//     console.log(
//       "Run `kp = await createKeyPair("my seed phrase")` to save your seed with IDX and create the SkyDB key pair"
//     )
//     console.log(
//       "You can then run `kp = await loadKeyPair()` to retrieve the saved seed and create the SkyDB key pair"
//     )
//     console.log(
//       "Run `await skynet.db.setJSON(kp.privateKey, "hello", {hello: "SkyDB with IDX"})` to save data in SkyDB"
//     )
//     console.log(
//       "You can then run `await skynet.db.getJSON(kp.publicKey, "hello")` to load the saved data"
//     )
}

const connect = async() => {
  if(!window.did){
    let dots = 0
    let timer: any = setInterval(() => {
      dots = (dots + 1) % 4
      $("#connectButton").html("Connecting" + ".".repeat(dots))
    }, 500)
    clearTimeout(timer - 1)
    authenticate()
    .then( () => {
      let id: any = window.did?.id
      let label: any = id?.substr(6, 4) + "..." + id?.substr(id.length - 4)
      clearTimeout(timer)
      $("#connectButton").html(label)
    })
    .catch( (err) => {
      $("#connectButton").html("Connect")
      console.error(err)
    })
  }
  else{
    let id: any = window.did?.id
    let label: any = id?.substr(6, 4) + "..." + id?.substr(id.length - 4)
    $("#connectButton").html(label)
  }
}

$("#connectButton").click( async() => {  
  connect()
})

const generateRandomSeedPhrase = () => { 
  const mnemonic = bip39.generateMnemonic()
  return bip39.mnemonicToSeedHex(mnemonic)
}

const hideModals = () => {
  $(".modal").prop("style", "display: none;")
}

const showSeedPhraseModal = () => {
  hideModals()
  $("#seedPhraseInput").val("")
  $("#seedPhraseModal").prop("style", "display: grid;")
}

$(".modal_close").click( () => {
  hideModals()
})


$("#confirmSeedPhraseButton").click( async() => {
  let seed_phrase: any = $("#seedPhraseInput").val()
  if(seed_phrase.length > 0) {
    try {
      await window.createKeyPair(seed_phrase)
      hideModals()
    }
    catch(err) {
      console.log(err)
    }
  }
})

$("#generateSeedPhraseButton").click( () => {
  $("#seedPhraseInput").val(generateRandomSeedPhrase())
})

$("#copySeedPhraseButton").click( () => {
  const str: any = $("#seedPhraseInput").val()
  const el = document.createElement("textarea")
  el.value = str
  el.setAttribute("readonly", "")
  el.style.position = "absolute"
  el.style.left = "-9999px"
  document.body.appendChild(el)
  const selection = document.getSelection()
  if(selection){
    const selected =
      selection.rangeCount > 0
        ? selection.getRangeAt(0)
        : false
    el.select()
    document.execCommand("copy")
    document.body.removeChild(el)
    if (selected) {
      document.getSelection()?.removeAllRanges()
      document.getSelection()?.addRange(selected)
    }
  }
  $("#copySeedPhraseButton").html("✍")
  setTimeout(() => {
    $("#copySeedPhraseButton").html("Copy")
  }, 1000)

})

const showSaveModal = () => {
  hideModals()
  console.log(app)
  if(app["current_trip"]["tags"]) {
    // $("#tripNameInput").val(app["current_trip"]["name"])
    $("#tripTagsInput").val(app["current_trip"]["tags"])
    $("#isTripPublicCheckBox").prop("checked", app["current_trip"]["public"])
  }
  else {
    $("#tripNameInput").val("")
    $("#tripTagsInput").val("")
    $("#isTripPublicCheckBox").prop("checked", false)
  }
  $("#confirmSaveButton").html("Confirm")
  $("#saveModal").prop("style", "display: grid;")
}

$("#closeSaveModalButton").click( () => {
  hideModals()
})

const initiateSave = async() => {
  connect()
  try {
    let kp = await window.loadKeyPair()
    if(kp) {
      showSaveModal()
    }
    else{
      showSeedPhraseModal()
      console.log("no seeds found.")
    }

  }
  catch(err){
    console.log(err)
  }
}

$("#saveButton").click( async() => {
  initiateSave()
})

$("#generateTripNameButton").click( () => {
  $("#tripNameInput").val(png({words: 3}).dashed)
})

$("#confirmSaveButton").click( async() => {
  let trip_name: any = $("#tripNameInput").val()
  if(!trip_name.length){
    console.log("trip name cannot be empty.")
    return
  }
  let tags: any = $("#tripTagsInput").val()
  let is_public: any = $("#isTripPublicCheckBox").is(":checked")
  let trip = {
    "tags": tags,
    "public": is_public,
    "body": html_editor.session.getValue(),
    "css": css_editor.session.getValue(),
    "js": js_editor.session.getValue()
  }
  try {
    let kp = await window.loadKeyPair()
    let res = await window.skynet.db.getJSON(kp.publicKey,
                                             userRepoKey)
    let trips = res ? res.data : {}    
    trips[trip_name] = trip
    // console.log("my trips: ", trips)
    await window.skynet.db.setJSON(kp.privateKey,
                                   userRepoKey,
                                   trips)
    app["saved"] = true
    app["current_trip"] = trip
    if(is_public == true){
      res = await window.skynet.db.getJSON(appKeyPair.publicKey,
                                           appRepoKey)
      let public_trips = res ? res.data : {}
      // console.log("public trips: ", public_trips)
      const id: any = window.did?.id
      if(id){
        const public_trip_name = id.substr(6) + public_trip_name_separator + trip_name
        public_trips[public_trip_name] = trip
        await window.skynet.db.setJSON(appKeyPair.privateKey,
                                       appRepoKey,
                                       public_trips)
      }
      else{
        console.log("Warning: no did was found, cannot save this public trip.")
      }
    }
    // success
    hideModals()
  }
  catch (e) {
    console.log(e)
  }
})

$("#wl2x2").click( () => {
  $("#workspace").prop("class", "workspace workspace2x2")
  $("#output").prop("style", "")
  $("#wl2x2 .wl_cell").prop("style", "background-color: #ffd591")
  $("#wl3x1 .wl_cell").prop("style", "background-color: lavender")
})

$("#wl3x1").click( () => {
  $("#workspace").prop("class", "workspace workspace3x1")
  $("#output").prop("style", "grid-column-start: 1; grid-column-end: 4;")
  $("#wl3x1 .wl_cell").prop("style", "background-color: #ffd591")
  $("#wl2x2 .wl_cell").prop("style", "background-color: lavender")
})

const onEditorChange = () => {  
  app["saved"] = false
}

let html_editor,
    css_editor,
    js_editor

const setupEditors = () => {
  html_editor = ace.edit("htmlEditor")
  html_editor.setOptions({
    mode: "ace/mode/html",
    theme: "ace/theme/monokai",
    selectionStyle: "text"
  })
  html_editor.session.on('change', onEditorChange);

  css_editor = ace.edit("cssEditor")
  css_editor.setOptions({
    mode: "ace/mode/css",
    theme: "ace/theme/monokai",
    selectionStyle: "text"
  })
  css_editor.session.on('change', onEditorChange);

  js_editor = ace.edit("jsEditor")
  js_editor.setOptions({
    mode: "ace/mode/javascript",
    theme: "ace/theme/monokai",
    selectionStyle: "text"
  })
  js_editor.session.on('change', onEditorChange);
}

const render = () => {
  let body = html_editor.session.getValue()
  let css = css_editor.session.getValue()
  let js = js_editor.session.getValue()
  let page = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>WYSIWIG</title>
      <script type="text/javascript">` + js + `</script>
      <style type="text/css">` + css + `</style>` + `
    </head>
    <body>` + body + 
    `</body>
    </html>`    
  $("#output").prop("srcdoc", page)
}

$("#runButton").click( () => {
  render()        
})

const toggleMineButton = (toggled: boolean) => {
  $("#mineButton").prop("style", 
    toggled ? "box-shadow: .1em .1em lavender; font-style: italic;"
            : "box-shadow: none; font-style: normal;"
    )
  $("#exploreButton").prop("style", 
    !toggled ? "box-shadow: .1em .1em lavender; font-style: italic;"
             : "box-shadow: none; font-style: normal;"
    )
}

$("#tripsButton").click( () => {  
  hideModals()
  toggleMineButton(false)
  $("#tripSearchInput").val("")
  $("#tripContent").empty()
  $("#tripsModal").prop("style", "display: grid")
  explore()
})

const populateTrips = (trips, exploring=false) => {
  $("#tripContent").empty()
  for(const trip_name of Object.keys(trips)) {
    const trip = trips[trip_name]
    const html_ele = $("<div class='trip_html'></div>")
      .text(trip["body"])
    let tag_ele = $("<div class='trip_tags'></div>")
      .text("Tags: " + trip.tags)
    let trip_label = trip_name
    if(exploring == true) {      
      const sep_pos = trip_name.lastIndexOf(public_trip_name_separator)
      const id = trip_name.substr(0, sep_pos)
      trip_label = "Author: " + id.substr(0, 4) + "..." + id.substr(-4)
    }
    let name_ele = $("<div class='trip_name'></div>")
      .text(trip_label)
    let trip_ele = $(
      "<div class='trip_item' data-tripid=" + trip_name + "></div>")
    trip_ele.append(html_ele, tag_ele, name_ele)
    $("#tripContent").append(trip_ele)
  }
}

const loadMyTrips = async() => {
  connect()
  try {
    let kp = await window.loadKeyPair()    
    if(kp) {
      let res = await window.skynet.db.getJSON(kp.publicKey,
                                               userRepoKey)
      if(res){
        populateTrips(res.data)        
      }  
      else {
        console.log("you have no trips, start one.")
      }
    }
    else{
      console.log("no seeds found.")
      showSeedPhraseModal()
    }
  }
  catch(err){
    console.log(err)
  }
}
$("#mineButton").click( () => {
  toggleMineButton(true)
  loadMyTrips()  
})

const explore = async() => {
  try {
    let res = await window.skynet.db.getJSON(appKeyPair.publicKey,
                                             appRepoKey)
    if(res){
      let public_trips = res.data
      if(window.did){
        const id: any = window.did?.id.substr(6)
        for(const trip_name in res.data) {
          const sep_pos = trip_name.lastIndexOf(public_trip_name_separator)
          const trip_author_id = trip_name.substr(0, sep_pos)
          if(id == trip_author_id) {
            delete public_trips[trip_name]
          }
        }
      }
      populateTrips(public_trips, true)
    }
    else{
      console.log("no public trips yet.")
    }
  }
  catch(err){
    console.log(err)
  }
}

$("#exploreButton").click( () => {
  toggleMineButton(false)  
  explore()
})

$("#tripContent").on("click", ".trip_item", async(e) => {
  const trip_id = $(e.target).data("tripid")
  const sep_pos = trip_id.lastIndexOf(public_trip_name_separator)
  if(sep_pos < 0){
    // my trip
    if((app["saved"] == true) || (confirm("Discard changes?") == true)) {      
      connect()
      let kp = await window.loadKeyPair()    
      if(kp) {
        let res = await window.skynet.db.getJSON(kp.publicKey,
                                                 userRepoKey)
        if(res){
          const my_trips = res.data
          // console.log(my_trips)
          const trip = my_trips[trip_id]
          html_editor.session.setValue(trip["body"])
          css_editor.session.setValue(trip["css"])
          js_editor.session.setValue(trip["js"])      
          app["saved"] = true
          app["current_trip"] = trip
        }  
        else {
          console.log("you have no trips, start one.")
        }
      }
      else{
        console.log("no seeds found.")
        showSeedPhraseModal()
      }     
    }
  }
  else{
    // fork
    window.open(location.href + "?" + "trip_id=" + trip_id,
      "_blank")
  }
})

const fork = async(q) => {
  if(!q.length) {
    return
  }
  try {
    const params = queryString.parse(location.search)
    // console.log("params: ",  params)
    const trip_id = params["trip_id"]
    let res = await window.skynet.db.getJSON(appKeyPair.publicKey,
                                             appRepoKey)
    if(res){
      const public_trips = res.data
      // console.log(public_trips)
      const trip = public_trips[trip_id]
      // console.log(trip)
      html_editor.session.setValue(trip["body"])
      css_editor.session.setValue(trip["css"])
      js_editor.session.setValue(trip["js"])
    }

  }
  catch(e) {
    console.log(e)
  }
}

$(document).keypress( (e) => {
  if(e.key == "Escape"){
    $(".modal").prop("style", "display: none;")
  }
})

$(document).ready( () => { 
  setupEditors()
  fork(location.search)  
})
