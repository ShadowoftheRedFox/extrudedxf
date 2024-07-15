import { AfterViewInit, Component, inject } from '@angular/core';
import { RendererService } from '../../services/renderer.service';
import { NgIf } from '@angular/common';
import { ConfigService } from '../../services/config.service';
import { NgModel } from '@angular/forms';
import { Vector3 } from 'three';

@Component({
  selector: 'ft-param-menu',
  standalone: true,
  imports: [NgIf],
  templateUrl: './param-menu.component.html',
  styleUrls: ['./param-menu.component.scss'],
})
export class ParamMenuComponent implements AfterViewInit {
  service = inject(RendererService);
  config = inject(ConfigService);
  liveChange = true;
  lookx = 0;
  looky = 0;
  lookz = 0;

  constructor() { }

  ngAfterViewInit(): void {
    const menu = document.getElementById("drag-menu");
    if (menu) {
      dragElement(menu);
      Array.from(menu.children).forEach(element => {
        if (element.tagName == "INPUT" && element.getAttribute("type") == "number") {
          const el = element as HTMLInputElement;
          el.onkeydown = (e) => {
            console.log(e);
            if (e.key == "ArrowUp") {
              el.value = '' + (parseFloat(el.value) + parseFloat(el.step));
            } else if (e.key == "ArrowDown") {
              el.value = '' + (parseFloat(el.value) - parseFloat(el.step));
            }
          }
        }
      });
    };
  }

  onChange(type: string, ev: any) {
    // console.log(ev.target.value); return;
    switch (type) {
      case "camx":
        this.camera.position.x = parseFloat(ev.target.value);
        break;
      case "camy":
        this.camera.position.y = parseFloat(ev.target.value);
        break;
      case "camz":
        this.camera.position.z = parseFloat(ev.target.value);
        break;

      case "camrx":
        this.camera.rotation.x = parseFloat(ev.target.value);
        break;
      case "camry":
        this.camera.rotation.y = parseFloat(ev.target.value);
        break;
      case "camrz":
        this.camera.rotation.z = parseFloat(ev.target.value);
        break;

      case "lookx":
        this.lookx = parseFloat(ev.target.value);
        if (this.liveChange) {
          this.camera.lookAt(this.lookx, this.looky, this.lookz);
        }
        break;
      case "looky":
        this.looky = parseFloat(ev.target.value);
        if (this.liveChange) {
          this.camera.lookAt(this.lookx, this.looky, this.lookz);
        }
        break;
      case "lookz":
        this.lookz = parseFloat(ev.target.value);
        if (this.liveChange) {
          this.camera.lookAt(this.lookx, this.looky, this.lookz);
        }
        break;

      case "camqx":
        this.camera.quaternion.x = parseFloat(ev.target.value);
        break;
      case "camqy":
        this.camera.quaternion.y = parseFloat(ev.target.value);
        break;
      case "camqz":
        this.camera.quaternion.z = parseFloat(ev.target.value);
        break;
      case "camqw":
        this.camera.quaternion.w = parseFloat(ev.target.value);
        break;

      case "FOV":
        this.camera.fov = parseFloat(ev.target.value);
        break;

      case "configVerbose":
        this.config.verbose = !this.config.verbose;
        console.info(`Verbose: ${this.config.verbose ? "on" : "off"}`)
        break;
      default:
        break;
    }
    ev.stopPropagation();
  }

  lookAtCam() {
    this.camera.lookAt(new Vector3(this.lookx, this.looky, this.lookz));
  }

  get scene() {
    return this.service.scene;
  }

  get camera() {
    return this.service.camera;
  }
  get renderGroup() {
    return this.service.renderGroup;
  }
}

function dragElement(element: HTMLElement) {
  var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  var w = element.offsetWidth, h = element.offsetHeight;

  function size() {
    w = element.offsetWidth;
    h = element.offsetHeight;
  }
  element.onresize = size;
  element.onclick = size;
  element.ondrag = size;
  element.onmousedown = size;

  const header = document.getElementById(element.id + "-header");
  // if present, the header is where you move the DIV from:
  if (header) {
    header.onmousedown = dragMouseDown;
  } else {
    // otherwise, move the DIV from anywhere inside the DIV:
    element.onmousedown = dragMouseDown;
  }

  function dragMouseDown(e: MouseEvent) {
    e = e || window.event;
    e.preventDefault();
    // get the mouse cursor position at startup:
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.addEventListener("mouseup", closeDragElement)
    // call a function whenever the cursor moves:
    document.addEventListener("mousemove", elementDrag)
  }

  function elementDrag(e: MouseEvent) {
    e = e || window.event;
    e.preventDefault();
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // set the element's new position:
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
    // prevent from going out of the window
    if (parseInt((element.style.top).split("px")[0]) < 0) {
      element.style.top = "0px";
    }
    if (parseInt((element.style.left).split("px")[0]) < 0) {
      element.style.left = "0px";
    }
    if (parseInt((element.style.top).split("px")[0]) + h > window.innerHeight) {
      element.style.top = (window.innerHeight - h) + "px";
    }
    if (parseInt((element.style.left).split("px")[0]) + w > window.innerWidth) {
      element.style.left = (window.innerWidth - w) + "px";
    }
  }

  function closeDragElement() {
    // stop moving when mouse button is released:
    document.removeEventListener("mouseup", closeDragElement)
    document.removeEventListener("mousemove", elementDrag)
  }
}
