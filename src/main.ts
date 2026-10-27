/**
 * Point d'entrée. L'ordre des imports compte peu (les modules se référencent entre eux),
 * mais la boucle, qui démarre la partie, doit venir en dernier.
 */
import './styles/app.css';
import './app/dom';
import './app/state';
import './app/game';
import './render/projection';
import './render/kit';
import './render/terrain';
import './render/decor';
import './render/buildings';
import './render/units';
import './render/fx';
import './render/overlays';
import './render/renderer';
import './ui/panels';
import './ui/input';
import './ui/loop';
