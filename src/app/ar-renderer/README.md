# AR component

Explication de comment il fonctionne et de comment l'implémenter et le déboguer.  
A noter, pour faire court: AR = Augemnted reality = réalité augmenté

- [AR component](#ar-component)
- [TODO](#todo)
- [Implementation](#implementation)
- [Explication](#explication)
  - [HTML](#html)
  - [TS](#ts)
- [Debug](#debug)
- [Ressources:](#ressources)
  - [Style des boutons AR](#style-des-boutons-ar)

# TODO

- [x] Prendre un évènement (pour this.ARContainer à null) quand le mode AR se termine/quitte, car si l'on redémarre le mode, pas sur que les boutons se ré affichent
- [ ] Rotation centré sur le centre de l'objet et non un coin
- [x] Bouton plus grand en mode AR (avec surement un changement de style)
- [x] Styliser le bouton pour lancer l'AR (id = ARButton)
- [x] déplacement de la pergola avec le doigt si on la touche et glisse
- [ ] lors de la selection pour le déplacement, faire une bounding box au lieu de la pergola elle meme

# Implementation

Autre que les components à mettre, il y a:
- Le [style des boutons AR](#style-des-boutons-ar) à mettre dans le fichier CSS/SCSS global.
- Le [component menu](../components/param-menu/) est surtout présent pour le débug, et peut être enlevé.
- Le [component upload](../components/upload-files/upload-files.component.ts) à la ligne 20, ajoute une image et un objet par défaut si la condition est réalisé. Toute la condition peut être supprimée ou juste le boolean à false dans [configService](../services/config.service.ts).

# Explication

## HTML

Le fichier HTML ne contient que le renderer pour Three JS.  
Il y a cependant un bloc commennté, qui sont les boutons qui devraient s'afficher en mode AR.

> [!NOTE]
> Le bloc qui ajoute le HTML en mode AR se trouve à la ligne 191 du [component](./ar-renderer.component.ts).

## TS

Normallement tout est commenté sur le fichier lui-même.  
Documentation WebXR: https://developer.mozilla.org/fr/docs/Web/API/WebXR_Device_API  

# Debug

Une petite note pour pouvoir déboguer en mode AR.  
Il vous faut:
- Un téléphone compatible avec la réalité virtuelle.
- Un cable USB entre le PC et le téléphone.
- Ouvrir le projet sur le réseau local avec le protocol HTTPS: `ng serve --host=0.0.0.0 --ssl`

Pour commencer à déboguer, assurez vous que le téléphone est en mode développeur:
> [!NOTE] Le mode développeur doit nécéssairement être activé pour pouvoir déboguer avec le téléphone.  

- Android: Allez dans les paramètres -> A propos du téléphone -> Informations sur le logiciel -> numéro de version.  
Si ce n'est pas le bon endroit, il se trouve surement sous un autre item des informations logiciel, sinon recherchez sur Google.  

- iOS: Réglages > Confidentialité et sécurité. Sous Sécurité, activez le mode Développement.

Une fois le mode développeur activé, revenez dans les paramètres généraux. Tout en bas devrait se trouver un nouvel item "options de développement" (ou un nom en rapport avec développeur).  
Cliquez dessus et chercher un item "activer le débogage USB", et activez le.  
> [!CAUTION] Les paramètres développeur sont sensibles. Vérifiez bien ce que vous modifiez, et annulez tout changement une fois finis.

Connectez le téléphone à l'ordinateur avec le câble, puis allez sur un explorateur, et aller sur l'onglet "inspect devive".

> [!NOTE] Sur les navigateur basés sur Chromium, tapez "chrome://inspect/#devices" dans la barre de l'URL.

Vous allez recevoir une notification/popup sur le téléphone demandant l'autorisation pour les paramètres USB.  
CLiquez authorisé pour cet appareil et revenez sur votre onglet à déboguer.  
Sur l'ordinateur, le navigateur va détecter le téléphone et afficher les onglets ouverts. Cliquez sur "inspect" sur l'onglet de votre choix.  

Maintenant, vous avez accès à la page du téélphone comme si elle était sur l'ordinateur. Vous pouvez modifier et intéragir de l'ordinateur, qui sera répliqué sur le téléphone.  
Si vous ne voyez pas les éléments, essayez de re démarrer le téléphone et réesayez.

# Ressources:

## Style des boutons AR
```css
button#ARButton {
  position: absolute !important;
  bottom: calc(50% - 45px) !important;
}

.ar_overlay_button {
  // empeche la selection des icône des boutons
  user-select: none !important;
  -moz-user-select: none !important;
  -webkit-user-select: none !important;
  -ms-user-select: none !important;

  position: absolute !important;
  padding: 10px !important;
  background-color: #56e6ffa6 !important;
  height: 44px !important;

  &:active {
    background-color: #56e6ff49 !important;
  }
}

.middle {
  top: 50% !important;
}

.bottom {
  top: 80% !important;
}

.top {
  top: 20% !important;
}

.left {
  left: 0 !important;
  border-top-right-radius: 10px !important;
  border-bottom-right-radius: 10px !important;
}

.right {
  right: 0 !important;
  border-top-left-radius: 10px !important;
  border-bottom-left-radius: 10px !important;
}
```
