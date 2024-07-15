import { Injectable } from '@angular/core';

export interface DefaultContent {
  helperBox: boolean;
  enabled: boolean;
  group: string;
  background: string;
}

export enum Actions {
  Rien,
  Centrer,
  DessinerTrapeze,
  DessinerLignePerspective,
  ChoisirFace,
  Snap,
  Efface
}

export const ActionsKey = {
  Centrer: ["escape"],
  DessinerTrapeze: ["d"],
  DessinerLignePerspective: ["l"],
  ChoisirFace: ["f"],
  Snap: ["s"],
  Efface: ["backspace"],
}

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  defaultContent: DefaultContent = {
    enabled: true,
    group: "/assets/obj/default.gltf",
    background: "/assets/image/default.jpg",
    helperBox: true,
  }
  verbose = true;

  keyMap = new Map<string, boolean>();
  keyArray: string[] = [];

  /*
  Les méthodes ci dessous permettent de gérer des combinaisons d'entrés clavier
  */

  onKeyDown(ev: KeyboardEvent) {
    // remember this in map
    ev = ev || event; // to deal with IE
    let key = ev.key.toLowerCase();
    this.keyMap.set(key, true);

    // remember this in array
    // if (this.keyArray.indexOf(key) == -1) this.keyArray.push(key);
  }

  onkeyup(ev: KeyboardEvent) {
    // set to false in map
    ev = ev || event; // to deal with IE
    let key = ev.key.toLowerCase();
    this.keyMap.set(key, false);

    // remove in array
    // if (this.keyArray.indexOf(key) > -1) {
    //   this.keyArray.splice(this.keyArray.indexOf(key), 1);
    // }
  };

  //
  /**
   * @param event
   * @param stop si on stop la propagation
   * @param combinaisons  on un un tableau de combinaisons, qui contient les touches à avoir pour la réaliser
   * @returns la combinaison de touche est préssé
   */
  isPressed(event: KeyboardEvent, stop: boolean, ...combinaisons: string[][]) {
    const resultArray = [];
    let index = 0;
    for (const keys of combinaisons) {
      // on regarde si les touches de la combinaison sont préssées
      for (const key of keys) {
        if (/*this.keyArray.includes(key) ||*/ this.keyMap.get(key)) {
          resultArray.push(true);
          break;
        }
      }
      // si non, alors le resultat ne suit plus l'index
      if (resultArray.length - 1 != index) {
        return false;
      }
      index++;
    }
    if (stop) {
      // stop l'event si l'action est réalisée
      event.stopPropagation();
      event.preventDefault();
    }
    return true;
  };

  getActions(event: KeyboardEvent, stop = true): Actions {
    if (this.isPressed(event, stop, ActionsKey.Centrer))
      return Actions.Centrer;
    if (this.isPressed(event, stop, ActionsKey.DessinerTrapeze))
      return Actions.DessinerTrapeze;
    if (this.isPressed(event, stop, ActionsKey.DessinerLignePerspective))
      return Actions.DessinerLignePerspective;
    if (this.isPressed(event, stop, ActionsKey.ChoisirFace))
      return Actions.ChoisirFace;
    if (this.isPressed(event, stop, ActionsKey.Snap))
      return Actions.Snap;
    if (this.isPressed(event, stop, ActionsKey.Efface))
      return Actions.Efface;
    return Actions.Rien;
  }

  constructor() { }
}
