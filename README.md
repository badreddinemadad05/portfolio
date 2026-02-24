# Portfolio - Badreddine MADAD

Portfolio professionnel de Badreddine MADAD, etudiant en 3eme annee d'informatique a l'Universite de Namur.

## Informations Personnelles

- Nom: Badreddine MADAD
- Age: 20 ans
- Date de naissance: 9 avril 2005
- Etudes: 3eme annee Informatique - Universite de Namur
- Localisation: Namur, Belgique

## Technologies

- HTML5
- CSS3
- JavaScript
- Node.js/Express (backend contact)
- Nodemailer (envoi email)

## Structure

```
prtf/
|-- index.html
|-- styles.css
|-- script.js
|-- README.md
`-- backend/
    |-- .env.example
    |-- .gitignore
    |-- package.json
    |-- server.js
    `-- data/
```

## Installation

1. Installer Node.js (https://nodejs.org)
2. Aller dans le backend:

```bash
cd backend
npm install
```

3. Copier le fichier de configuration:

```bash
copy .env.example .env
```

4. Remplir les variables SMTP dans `backend/.env`
5. Demarrer le serveur:

```bash
npm start
```

Le backend tourne sur `http://localhost:3001`.

## Test rapide

1. Ouvrir `index.html` dans le navigateur
2. Remplir le formulaire de contact
3. Verifier la reception de l'email
4. Verifier la sauvegarde locale dans `backend/data/messages.json`
