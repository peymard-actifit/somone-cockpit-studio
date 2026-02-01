import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuthStore } from '../store/authStore';

// Types
export type Language = 'FR' | 'EN';

// Traductions par défaut du studio
export const DEFAULT_TRANSLATIONS: Record<string, { FR: string; EN: string }> = {
  // === Navigation et Header ===
  'nav.home': { FR: 'Accueil', EN: 'Home' },
  'nav.studio': { FR: 'Studio', EN: 'Studio' },
  'nav.back': { FR: 'Retour', EN: 'Back' },
  'nav.explodedView': { FR: 'Vue éclatée', EN: 'Exploded View' },
  
  // === Page d'accueil ===
  'home.title': { FR: 'SOMONE Cockpit Studio', EN: 'SOMONE Cockpit Studio' },
  'home.titleClient': { FR: 'OPEN COCKPIT', EN: 'OPEN COCKPIT' },
  'home.subtitle': { FR: 'Studio de création de maquettes', EN: 'Mockup creation studio' },
  'home.subtitleClient': { FR: 'Studio de création de maquettes pour les Clients. Si vous avez besoin d\'aide, l\'entreprise Somone est là pour vous en apporter.', EN: 'Mockup creation studio for Clients. If you need help, Somone is here to assist you.' },
  'home.newMockup': { FR: 'Nouvelle', EN: 'New' },
  'home.newFolder': { FR: 'Répertoire', EN: 'Folder' },
  'home.import': { FR: 'Importer', EN: 'Import' },
  'home.infos': { FR: 'Infos', EN: 'Info' },
  'home.users': { FR: 'Utilisateurs', EN: 'Users' },
  'home.tutorial': { FR: 'Tutoriel', EN: 'Tutorial' },
  'home.language': { FR: 'Langue', EN: 'Language' },
  'home.publications': { FR: 'Publications', EN: 'Publications' },
  'home.myMockups': { FR: 'Mes maquettes', EN: 'My mockups' },
  'home.sharedWithMe': { FR: 'Partagées avec moi', EN: 'Shared with me' },
  'home.noMockups': { FR: 'Aucune maquette', EN: 'No mockups' },
  'home.createFirst': { FR: 'Créez votre première maquette de cockpit', EN: 'Create your first cockpit mockup' },
  'home.createMockup': { FR: 'Créer une maquette', EN: 'Create a mockup' },
  'home.search': { FR: 'Rechercher...', EN: 'Search...' },
  'home.mockupsCount': { FR: 'maquettes disponibles', EN: 'mockups available' },
  'home.mockupCount': { FR: 'maquette disponible', EN: 'mockup available' },
  'home.returnToMyMockups': { FR: 'Retourner à mes maquettes', EN: 'Return to my mockups' },
  'home.noMockupsAccount': { FR: 'Ce compte n\'a pas encore de maquettes ni de répertoires', EN: 'This account has no mockups or folders yet' },
  'home.root': { FR: 'Racine', EN: 'Root' },
  'home.dropHere': { FR: 'Déposer ici', EN: 'Drop here' },
  'home.dropToRoot': { FR: 'Déposer ici pour remettre à la racine', EN: 'Drop here to move to root' },
  'home.ia': { FR: 'IA', EN: 'AI' },
  'home.configureIaPrompt': { FR: 'Configurer le prompt système de l\'IA', EN: 'Configure AI system prompt' },
  'home.mockupsInFolder': { FR: 'maquette(s) dans ce répertoire', EN: 'mockup(s) in this folder' },
  'home.mockupsSharedInFolder': { FR: 'maquette(s) partagée(s) dans ce répertoire', EN: 'mockup(s) shared in this folder' },
  'home.mockupsSharedWithYou': { FR: 'maquette(s) partagée(s) avec vous', EN: 'mockup(s) shared with you' },
  'home.foldersCount': { FR: 'répertoire(s)', EN: 'folder(s)' },
  'home.mockupsRootAdmin': { FR: 'maquette(s) à la racine de ce compte (mode admin)', EN: 'mockup(s) at root of this account (admin mode)' },
  'home.mockupsInFolderAdmin': { FR: 'maquette(s) dans ce répertoire (mode admin)', EN: 'mockup(s) in this folder (admin mode)' },
  'home.mockupsAvailable': { FR: 'maquette(s) disponible(s)', EN: 'mockup(s) available' },
  'home.journeyDesigner': { FR: 'Conception Parcours', EN: 'Journey Designer' },
  
  // === Menu utilisateur ===
  'user.connectedAs': { FR: 'Connecté en tant que', EN: 'Connected as' },
  'user.admin': { FR: 'Administrateur', EN: 'Administrator' },
  'user.standard': { FR: 'Standard', EN: 'Standard' },
  'user.client': { FR: 'Client', EN: 'Client' },
  'user.changeName': { FR: 'Modifier mon nom', EN: 'Change my name' },
  'user.changeEmail': { FR: 'Modifier mon email', EN: 'Change my email' },
  'user.changePassword': { FR: 'Changer le mot de passe', EN: 'Change password' },
  'user.adminMode': { FR: 'Passer administrateur', EN: 'Switch to admin' },
  'user.exitAdmin': { FR: 'Quitter le mode admin', EN: 'Exit admin mode' },
  'user.logout': { FR: 'Déconnexion', EN: 'Logout' },
  'user.language': { FR: 'Langue', EN: 'Language' },
  'user.french': { FR: 'Français', EN: 'French' },
  'user.english': { FR: 'Anglais', EN: 'English' },
  'user.viewMockups': { FR: 'Voir les maquettes', EN: 'View mockups' },
  'user.viewOtherAccounts': { FR: 'Voir les maquettes d\'un autre compte', EN: 'View mockups of another account' },
  'user.activateAdminMode': { FR: 'Activer le mode administrateur', EN: 'Enable admin mode' },
  'user.exitAdminMode': { FR: 'Quitter le mode administrateur', EN: 'Exit admin mode' },
  'user.exitAdminInfo': { FR: 'Vous allez quitter le mode administrateur. Vous perdrez les privilèges d\'administration.', EN: 'You will exit admin mode. You will lose admin privileges.' },
  'user.enterAdminCode': { FR: 'Entrez le code administrateur pour activer les privilèges d\'administration.', EN: 'Enter the admin code to enable admin privileges.' },
  'user.adminCode': { FR: 'Code administrateur', EN: 'Admin code' },
  'user.adminCodePlaceholder': { FR: 'Entrez le code administrateur', EN: 'Enter admin code' },
  'user.activate': { FR: 'Activer', EN: 'Activate' },
  
  // === Actions sur les maquettes ===
  'mockup.open': { FR: 'Ouvrir', EN: 'Open' },
  'mockup.edit': { FR: 'Modifier', EN: 'Edit' },
  'mockup.duplicate': { FR: 'Dupliquer', EN: 'Duplicate' },
  'mockup.delete': { FR: 'Supprimer', EN: 'Delete' },
  'mockup.publish': { FR: 'Publier', EN: 'Publish' },
  'mockup.unpublish': { FR: 'Dépublier', EN: 'Unpublish' },
  'mockup.share': { FR: 'Partager', EN: 'Share' },
  'mockup.export': { FR: 'Exporter', EN: 'Export' },
  'mockup.rename': { FR: 'Renommer', EN: 'Rename' },
  'mockup.move': { FR: 'Déplacer', EN: 'Move' },
  'mockup.created': { FR: 'Créée le', EN: 'Created on' },
  'mockup.modified': { FR: 'Modifiée le', EN: 'Modified on' },
  'mockup.published': { FR: 'Publiée', EN: 'Published' },
  'mockup.notPublished': { FR: 'Non publiée', EN: 'Not published' },
  'mockup.clickToOpen': { FR: 'Cliquer pour ouvrir', EN: 'Click to open' },
  'mockup.dragToReorder': { FR: 'Glisser pour réorganiser', EN: 'Drag to reorder' },
  'mockup.copyUrl': { FR: 'Copier l\'URL', EN: 'Copy URL' },
  'mockup.openPublished': { FR: 'Ouvrir la version publiée', EN: 'Open published version' },
  'mockup.editWelcome': { FR: 'Modifier le message d\'accueil', EN: 'Edit welcome message' },
  'mockup.addWelcome': { FR: 'Ajouter un message d\'accueil', EN: 'Add welcome message' },
  'mockup.noName': { FR: 'Sans nom', EN: 'Unnamed' },
  'mockup.copy': { FR: '- Copie', EN: '- Copy' },
  
  // === Dossiers ===
  'folder.new': { FR: 'Nouveau répertoire', EN: 'New folder' },
  'folder.rename': { FR: 'Renommer', EN: 'Rename' },
  'folder.delete': { FR: 'Supprimer le répertoire', EN: 'Delete folder' },
  'folder.empty': { FR: 'Répertoire vide', EN: 'Empty folder' },
  'folder.contains': { FR: 'maquettes', EN: 'mockups' },
  'folder.mockup': { FR: 'maquette', EN: 'mockup' },
  'folder.mockups': { FR: 'maquettes', EN: 'mockups' },
  'folder.mustBeEmpty': { FR: 'Le répertoire doit être vide pour être supprimé', EN: 'Folder must be empty to be deleted' },
  'folder.dragToReorder': { FR: 'Glisser pour réorganiser', EN: 'Drag to reorder' },
  
  // === Studio / Éditeur ===
  'studio.actions': { FR: 'Actions', EN: 'Actions' },
  'studio.presentation': { FR: 'Présentation', EN: 'Presentation' },
  'studio.explodedView': { FR: 'Vue éclatée', EN: 'Exploded View' },
  'studio.translate': { FR: 'Traduire', EN: 'Translate' },
  'studio.exportExcel': { FR: 'Export Excel', EN: 'Export Excel' },
  'studio.autoSave': { FR: 'Auto-save', EN: 'Auto-save' },
  'studio.saved': { FR: 'Sauvegardé', EN: 'Saved' },
  'studio.tutorial': { FR: 'Tutoriel', EN: 'Tutorial' },
  'studio.reviewTutorial': { FR: 'Revoir', EN: 'Review' },
  'studio.by': { FR: 'Par', EN: 'By' },
  'studio.modifiedAgo': { FR: 'Modifié il y a quelques secondes', EN: 'Modified a few seconds ago' },
  'studio.backToExplodedView': { FR: 'Retour à la vue éclatée', EN: 'Back to exploded view' },
  'studio.presentationGenerator': { FR: 'Générateur de présentations automatisées', EN: 'Automated presentation generator' },
  'studio.explodedViewTitle': { FR: 'Vue éclatée de la maquette', EN: 'Mockup exploded view' },
  'studio.testTutorial': { FR: 'Tester le tutoriel (mode admin)', EN: 'Test tutorial (admin mode)' },
  'studio.startTutorial': { FR: 'Lancer le tutoriel', EN: 'Start tutorial' },
  'studio.hidePanel': { FR: 'Masquer le panneau', EN: 'Hide panel' },
  'studio.showPanel': { FR: 'Afficher le panneau', EN: 'Show panel' },
  'studio.iaGpt': { FR: 'IA GPT', EN: 'AI GPT' },
  'studio.translation': { FR: 'Traduction', EN: 'Translation' },
  'studio.journey': { FR: 'Parcours', EN: 'Journey' },
  // Examples library
  'examples.title': { FR: 'Bibliothèque d\'exemples', EN: 'Examples Library' },
  'examples.button': { FR: 'Exemples', EN: 'Examples' },
  'examples.subtitleEdit': { FR: 'Créez et gérez des exemples réutilisables', EN: 'Create and manage reusable examples' },
  'examples.subtitleView': { FR: 'Consultez et copiez des exemples dans vos cockpits', EN: 'Browse and copy examples to your cockpits' },
  'examples.newCategory': { FR: 'Nouvelle catégorie...', EN: 'New category...' },
  'examples.addCategory': { FR: 'Ajouter', EN: 'Add' },
  'examples.empty': { FR: 'Aucun exemple disponible', EN: 'No examples available' },
  'examples.emptyHint': { FR: 'Commencez par créer une catégorie ci-dessus', EN: 'Start by creating a category above' },
  'examples.elementName': { FR: 'Nom de l\'élément...', EN: 'Element name...' },
  'examples.add': { FR: 'Ajouter', EN: 'Add' },
  'examples.cancel': { FR: 'Annuler', EN: 'Cancel' },
  'examples.addElement': { FR: 'Ajouter un élément', EN: 'Add an element' },
  'examples.copyToDomain': { FR: 'Copier vers un domaine', EN: 'Copy to domain' },
  'examples.domain': { FR: 'Domaine', EN: 'Domain' },
  'examples.selectDomain': { FR: 'Sélectionner un domaine...', EN: 'Select a domain...' },
  'examples.category': { FR: 'Catégorie', EN: 'Category' },
  'examples.selectCategory': { FR: 'Sélectionner une catégorie...', EN: 'Select a category...' },
  'examples.copy': { FR: 'Copier', EN: 'Copy' },
  'examples.subCategories': { FR: 'sous-cat.', EN: 'sub-cat.' },
  'examples.subElements': { FR: 'sous-él.', EN: 'sub-elem.' },
  'examples.subCategoryName': { FR: 'Nom de la sous-catégorie...', EN: 'Sub-category name...' },
  'examples.addSubCategory': { FR: 'Ajouter sous-catégorie', EN: 'Add sub-category' },
  'examples.subElementName': { FR: 'Nom...', EN: 'Name...' },
  'examples.addSubElement': { FR: '+ sous-él.', EN: '+ sub-elem.' },
  'examples.elementCount': { FR: 'élément', EN: 'element' },
  'examples.elementsCount': { FR: 'éléments', EN: 'elements' },
  'examples.deleteCategory': { FR: 'Supprimer la catégorie', EN: 'Delete category' },
  'examples.deleteCategoryConfirm': { FR: 'Supprimer la catégorie "{name}" ?', EN: 'Delete category "{name}"?' },
  'examples.deleteElement': { FR: 'Supprimer l\'élément', EN: 'Delete element' },
  'examples.deleteElementConfirm': { FR: 'Supprimer l\'élément "{name}" ?', EN: 'Delete element "{name}"?' },
  'examples.deleteSubCategory': { FR: 'Supprimer', EN: 'Delete' },
  'examples.deleteSubCategoryConfirm': { FR: 'Supprimer "{name}" ?', EN: 'Delete "{name}"?' },
  'examples.deleteSubElement': { FR: 'Supprimer', EN: 'Delete' },
  'examples.deleteSubElementConfirm': { FR: 'Supprimer "{name}" ?', EN: 'Delete "{name}"?' },
  'examples.copySuccess': { FR: 'Élément copié avec succès !', EN: 'Element copied successfully!' },
  'examples.copyError': { FR: 'Erreur lors de la copie', EN: 'Error while copying' },
  'examples.worstStatus': { FR: 'Statut le plus critique', EN: 'Most critical status' },
  'examples.editIcon': { FR: 'Modifier l\'icône', EN: 'Edit icon' },
  'examples.editStatus': { FR: 'Modifier le statut', EN: 'Edit status' },
  // Examples view selector (nouveau)
  'examples.selectDescription': { FR: 'Sélectionnez les vues exemples à afficher dans ce cockpit', EN: 'Select the example views to display in this cockpit' },
  'examples.activeInCockpit': { FR: 'Vues exemples actives dans ce cockpit', EN: 'Active example views in this cockpit' },
  'examples.noActiveViews': { FR: 'Aucune vue exemples dans ce cockpit', EN: 'No example views in this cockpit' },
  'examples.importHint': { FR: 'Importez des vues depuis la liste ci-dessous', EN: 'Import views from the list below' },
  'examples.availableToImport': { FR: 'Vues exemples disponibles à importer', EN: 'Available example views to import' },
  'examples.noAvailableViews': { FR: 'Aucune vue exemples disponible à importer', EN: 'No example views available to import' },
  'examples.createHint': { FR: 'Créez des vues de type "Exemples" dans vos cockpits pour les voir ici', EN: 'Create "Examples" type views in your cockpits to see them here' },
  'examples.import': { FR: 'Importer', EN: 'Import' },
  'examples.removeFromCockpit': { FR: 'Retirer du cockpit', EN: 'Remove from cockpit' },
  'examples.removeFromCockpitConfirm': { FR: 'Voulez-vous retirer la vue "{name}" de ce cockpit ?', EN: 'Do you want to remove the view "{name}" from this cockpit?' },
  'examples.howItWorks': { FR: 'Comment ça marche ?', EN: 'How does it work?' },
  'examples.hint1': { FR: 'Les vues exemples sont des domaines de type "Exemples" créés dans les cockpits', EN: 'Example views are "Examples" type domains created in cockpits' },
  'examples.hint2': { FR: 'Importer une vue copie son contenu dans le cockpit courant', EN: 'Importing a view copies its content to the current cockpit' },
  'examples.hint3': { FR: 'Vous pouvez ensuite modifier la vue importée indépendamment de l\'originale', EN: 'You can then modify the imported view independently from the original' },
  'examples.hint4': { FR: 'Pour créer une nouvelle vue exemples, ajoutez un domaine et choisissez le type "Exemples"', EN: 'To create a new example view, add a domain and choose the "Examples" type' },
  // Common actions
  'common.delete': { FR: 'Supprimer', EN: 'Delete' },
  'common.cancel': { FR: 'Annuler', EN: 'Cancel' },
  'common.confirm': { FR: 'Confirmer', EN: 'Confirm' },
  'common.save': { FR: 'Enregistrer', EN: 'Save' },
  'common.close': { FR: 'Fermer', EN: 'Close' },
  'common.loading': { FR: 'Chargement...', EN: 'Loading...' },
  'common.importing': { FR: 'Import...', EN: 'Importing...' },
  'public.upToDate': { FR: 'A jour', EN: 'Up to date' },
  'public.visitor': { FR: 'Visiteur', EN: 'Visitor' },
  'public.consultationMode': { FR: 'Mode consultation', EN: 'Consultation mode' },
  'public.published': { FR: 'Version publiée', EN: 'Published version' },
  'public.readOnly': { FR: 'Lecture seule', EN: 'Read only' },
  'public.availableDates': { FR: 'Dates disponibles', EN: 'Available dates' },
  
  // === Types d'éléments (pour les modifications récentes) ===
  'type.domain': { FR: 'Domaine', EN: 'Domain' },
  'type.category': { FR: 'Cat.', EN: 'Cat.' },
  'type.element': { FR: 'Élém.', EN: 'Elem.' },
  'type.subCategory': { FR: 'Sous-cat.', EN: 'Sub-cat.' },
  'type.subElement': { FR: 'Sous-élém.', EN: 'Sub-elem.' },
  'type.mapElement': { FR: 'Point', EN: 'Point' },
  
  // === Domain View ===
  'domain.clickToSeeIndicators': { FR: 'Cliquez pour voir tous les indicateurs du domaine', EN: 'Click to see all domain indicators' },
  'domain.deleteCategory': { FR: 'Supprimer la catégorie', EN: 'Delete category' },
  'domain.deleteCategoryConfirm': { FR: 'Voulez-vous supprimer la catégorie et tous ses éléments ?', EN: 'Do you want to delete this category and all its elements?' },
  'domain.add': { FR: 'Ajouter', EN: 'Add' },
  'domain.addCategory': { FR: 'Ajouter une catégorie', EN: 'Add category' },
  'domain.categoryName': { FR: 'Nom de la catégorie', EN: 'Category name' },
  'domain.newCategory': { FR: 'Nouvelle catégorie', EN: 'New category' },
  
  // === Editor Panel - Menus d'édition ===
  'editor.editDomain': { FR: 'Édition domaine', EN: 'Edit domain' },
  'editor.editElement': { FR: 'Édition élément', EN: 'Edit element' },
  'editor.editSubElement': { FR: 'Édition sous-élément', EN: 'Edit sub-element' },
  'editor.back': { FR: 'Retour', EN: 'Back' },
  'editor.preview': { FR: 'Aperçu', EN: 'Preview' },
  'editor.properties': { FR: 'Propriétés', EN: 'Properties' },
  'editor.statusColor': { FR: 'Statut (couleur)', EN: 'Status (color)' },
  'editor.deleteIcon': { FR: 'Supprimer l\'icône', EN: 'Delete icon' },
  'editor.deleteImage': { FR: 'Supprimer l\'image', EN: 'Delete image' },
  'editor.standard': { FR: 'Standard', EN: 'Standard' },
  'editor.categoriesAndElements': { FR: 'Catégories et éléments', EN: 'Categories and elements' },
  
  // Domain actions
  'editor.copyElementsToAnotherDomain': { FR: 'Copier les éléments vers un autre domaine', EN: 'Copy elements to another domain' },
  'editor.deleteAllElements': { FR: 'Supprimer tous les éléments', EN: 'Delete all elements' },
  'editor.deleteAllElementsConfirm': { FR: 'Voulez-vous supprimer les {count} élément(s) du domaine "{name}" ?\n\nCette action supprimera également toutes les sous-catégories et sous-éléments associés.\n\n⚠️ Cette action est irréversible.', EN: 'Do you want to delete the {count} element(s) from domain "{name}"?\n\nThis action will also delete all associated sub-categories and sub-elements.\n\n⚠️ This action is irreversible.' },
  'editor.deleteAllElementsFromDomain': { FR: 'Supprimer tous les éléments du domaine', EN: 'Delete all elements from domain' },
  'editor.duplicateDomain': { FR: 'Dupliquer ce domaine', EN: 'Duplicate this domain' },
  'editor.deleteDomain': { FR: 'Supprimer le domaine', EN: 'Delete domain' },
  'editor.deleteDomainConfirm': { FR: 'Voulez-vous supprimer le domaine "{name}" et tout son contenu ?', EN: 'Do you want to delete the domain "{name}" and all its content?' },
  'editor.deleteThisDomain': { FR: 'Supprimer ce domaine', EN: 'Delete this domain' },
  'editor.categories': { FR: 'Catégories', EN: 'Categories' },
  'editor.addCategory': { FR: 'Ajouter une catégorie', EN: 'Add a category' },
  'editor.deleteCategoryConfirm': { FR: 'Voulez-vous supprimer la catégorie "{name}" ?', EN: 'Do you want to delete the category "{name}"?' },
  
  // Element actions
  'editor.copySubCategoriesToAnotherElement': { FR: 'Copier les sous-catégories vers un autre élément', EN: 'Copy sub-categories to another element' },
  'editor.deleteElement': { FR: 'Supprimer l\'élément', EN: 'Delete element' },
  'editor.deleteElementConfirm': { FR: 'Voulez-vous supprimer l\'élément "{name}" et tous ses sous-éléments ?', EN: 'Do you want to delete the element "{name}" and all its sub-elements?' },
  'editor.deleteThisElement': { FR: 'Supprimer cet élément', EN: 'Delete this element' },
  'editor.unlinkElement': { FR: 'Délier cet élément', EN: 'Unlink this element' },
  'editor.linkToAnotherElement': { FR: 'Lier à un autre élément...', EN: 'Link to another element...' },
  'editor.unlinkFromAll': { FR: 'Délier cet élément de tous', EN: 'Unlink this element from all' },
  'editor.elementNotLinked': { FR: 'Cet élément n\'est pas lié.', EN: 'This element is not linked.' },
  'editor.moveElementToCategory': { FR: 'Déplacer l\'élément vers une autre catégorie', EN: 'Move element to another category' },
  'editor.createNewCategoryAndMove': { FR: 'Créer une nouvelle catégorie et y déplacer l\'élément', EN: 'Create a new category and move the element' },
  'editor.moveToCategory': { FR: 'Déplacez l\'élément vers une autre catégorie ou créez-en une nouvelle', EN: 'Move the element to another category or create a new one' },
  'editor.createNewTemplate': { FR: 'Créer un nouveau template', EN: 'Create a new template' },
  'editor.subCategories': { FR: 'Sous-catégories', EN: 'Sub-categories' },
  'editor.deleteSubCategoryConfirm': { FR: 'Voulez-vous supprimer la sous-catégorie "{name}" ?', EN: 'Do you want to delete the sub-category "{name}"?' },
  'editor.subElements': { FR: 'Sous-éléments', EN: 'Sub-elements' },
  
  // Sub-element actions  
  'editor.deleteSubElement': { FR: 'Supprimer le sous-élément', EN: 'Delete sub-element' },
  'editor.deleteSubElementConfirm': { FR: 'Voulez-vous supprimer le sous-élément "{name}" ?', EN: 'Do you want to delete the sub-element "{name}"?' },
  'editor.deleteThisSubElement': { FR: 'Supprimer ce sous-élément', EN: 'Delete this sub-element' },
  'editor.unlinkSubElement': { FR: 'Délier ce sous-élément', EN: 'Unlink this sub-element' },
  'editor.linkToAnotherSubElement': { FR: 'Lier à un autre sous-élément...', EN: 'Link to another sub-element...' },
  'editor.unlinkSubElementFromAll': { FR: 'Délier ce sous-élément de tous', EN: 'Unlink this sub-element from all' },
  'editor.subElementNotLinked': { FR: 'Ce sous-élément n\'est pas lié.', EN: 'This sub-element is not linked.' },
  'editor.deleteAlert': { FR: 'Supprimer l\'alerte', EN: 'Delete alert' },
  
  // Copy modals
  'editor.copyElements': { FR: 'Copier les éléments', EN: 'Copy elements' },
  'editor.copyElementsDescription': { FR: 'Cette action copie toutes les <strong>catégories</strong> et tous les <strong>éléments</strong> du domaine actuel vers le domaine cible. Chaque élément copié sera <strong>lié</strong> à son élément d\'origine (synchronisation des statuts et valeurs).', EN: 'This action copies all <strong>categories</strong> and <strong>elements</strong> from the current domain to the target domain. Each copied element will be <strong>linked</strong> to its original element (status and value synchronization).' },
  'editor.targetDomain': { FR: 'Domaine cible', EN: 'Target domain' },
  'editor.noOtherDomainAvailable': { FR: 'Aucun autre domaine de type Background ou Map disponible.', EN: 'No other Background or Map type domain available.' },
  'editor.createTargetDomainFirst': { FR: 'Créez d\'abord un domaine cible de type Background ou Map.', EN: 'First create a target domain of type Background or Map.' },
  'editor.categoriesToCopy': { FR: 'Catégories et éléments à copier', EN: 'Categories and elements to copy' },
  'editor.noCategoryInDomain': { FR: 'Aucune catégorie dans ce domaine', EN: 'No category in this domain' },
  'editor.copySubCategories': { FR: 'Copier les sous-catégories', EN: 'Copy sub-categories' },
  'editor.copySubCategoriesDescription': { FR: 'Cette action copie toutes les sous-catégories et sous-éléments de cet élément vers l\'élément cible. Chaque sous-élément copié sera <strong>lié</strong> à son sous-élément d\'origine (synchronisation des statuts et valeurs).', EN: 'This action copies all sub-categories and sub-elements from this element to the target element. Each copied sub-element will be <strong>linked</strong> to its original sub-element (status and value synchronization).' },
  'editor.targetElement': { FR: 'Élément cible', EN: 'Target element' },
  'editor.noOtherElementAvailable': { FR: 'Aucun autre élément disponible', EN: 'No other element available' },
  'editor.subCategoriesToCopy': { FR: 'Sous-catégories à copier', EN: 'Sub-categories to copy' },
  'editor.noSubCategoryInElement': { FR: 'Aucune sous-catégorie dans cet élément', EN: 'No sub-category in this element' },
  
  // Default message
  'editor.selectToEdit': { FR: 'Sélectionnez un domaine ou un élément pour l\'éditer', EN: 'Select a domain or element to edit' },
  
  // Form labels
  'editor.nameLabel': { FR: 'Nom', EN: 'Name' },
  'editor.valueLabel': { FR: 'Valeur', EN: 'Value' },
  'editor.unitLabel': { FR: 'Unité', EN: 'Unit' },
  'editor.iconLabel': { FR: 'Icône', EN: 'Icon' },
  'editor.mainIcon': { FR: 'Icône principale', EN: 'Main icon' },
  'editor.icon2': { FR: 'Icône 2', EN: 'Icon 2' },
  'editor.icon3': { FR: 'Icône 3', EN: 'Icon 3' },
  'editor.chooseIcon': { FR: 'Choisir une icône...', EN: 'Choose an icon...' },
  'editor.customImage': { FR: 'Image personnalisée', EN: 'Custom image' },
  'editor.publiable': { FR: 'Publiable', EN: 'Publishable' },
  'editor.deleteCategory': { FR: 'Supprimer la catégorie', EN: 'Delete category' },
  'editor.deleteSubCategory': { FR: 'Supprimer la sous-catégorie', EN: 'Delete sub-category' },
  'editor.addSubCategory': { FR: 'Ajouter une sous-catégorie', EN: 'Add a sub-category' },
  'editor.addSubElement': { FR: 'Ajouter un sous-élément', EN: 'Add a sub-element' },
  'editor.linkedElements': { FR: 'Liaisons', EN: 'Links' },
  'editor.linkedTo': { FR: 'Lié à', EN: 'Linked to' },
  'editor.addNewLink': { FR: 'Ajouter une nouvelle liaison', EN: 'Add a new link' },
  'editor.moveToSubCategory': { FR: 'Déplacer vers une sous-catégorie', EN: 'Move to a sub-category' },
  'editor.createNewSubCategory': { FR: 'Créer une nouvelle sous-catégorie', EN: 'Create a new sub-category' },
  'editor.newSubCategory': { FR: 'Nouvelle sous-catégorie', EN: 'New sub-category' },
  'editor.categoryDirection': { FR: 'Direction de la catégorie', EN: 'Category direction' },
  'editor.horizontal': { FR: 'Horizontal', EN: 'Horizontal' },
  'editor.vertical': { FR: 'Vertical', EN: 'Vertical' },
  'editor.backgroundImage': { FR: 'Image de fond', EN: 'Background image' },
  'editor.backgroundColor': { FR: 'Couleur de fond', EN: 'Background color' },
  'editor.template': { FR: 'Template', EN: 'Template' },
  'editor.selectTemplate': { FR: 'Sélectionner un template', EN: 'Select a template' },
  'editor.width': { FR: 'Largeur', EN: 'Width' },
  'editor.height': { FR: 'Hauteur', EN: 'Height' },
  'editor.position': { FR: 'Position', EN: 'Position' },
  'editor.positionX': { FR: 'Position X', EN: 'Position X' },
  'editor.positionY': { FR: 'Position Y', EN: 'Position Y' },
  'editor.size': { FR: 'Taille', EN: 'Size' },
  'editor.applyToAll': { FR: 'Appliquer à tous', EN: 'Apply to all' },
  'editor.applySizeToAll': { FR: 'Appliquer cette taille à tous les éléments du domaine', EN: 'Apply this size to all elements in the domain' },
  'editor.copy': { FR: 'Copier', EN: 'Copy' },
  'editor.paste': { FR: 'Coller', EN: 'Paste' },
  'editor.duplicate': { FR: 'Dupliquer', EN: 'Duplicate' },
  'editor.delete': { FR: 'Supprimer', EN: 'Delete' },
  'editor.confirm': { FR: 'Confirmer', EN: 'Confirm' },
  'editor.alert': { FR: 'Alerte', EN: 'Alert' },
  'editor.alerts': { FR: 'Alertes', EN: 'Alerts' },
  'editor.noAlert': { FR: 'Aucune alerte', EN: 'No alert' },
  'editor.addAlert': { FR: 'Ajouter une alerte', EN: 'Add an alert' },
  'editor.alertMessage': { FR: 'Message d\'alerte', EN: 'Alert message' },
  'editor.threshold': { FR: 'Seuil', EN: 'Threshold' },
  'editor.condition': { FR: 'Condition', EN: 'Condition' },
  'editor.greaterThan': { FR: 'Supérieur à', EN: 'Greater than' },
  'editor.lessThan': { FR: 'Inférieur à', EN: 'Less than' },
  'editor.equals': { FR: 'Égal à', EN: 'Equals' },
  'editor.notEquals': { FR: 'Différent de', EN: 'Not equals' },
  'editor.pointIcon': { FR: 'Icône du point', EN: 'Point icon' },
  'editor.dragToReorder': { FR: 'Glisser pour réorganiser', EN: 'Drag to reorder' },
  'editor.from': { FR: 'Depuis', EN: 'From' },
  'editor.backgroundView': { FR: 'Vue Background', EN: 'Background View' },
  'editor.mapView': { FR: 'Vue Map', EN: 'Map View' },
  'editor.elementsCount': { FR: 'élément(s)', EN: 'element(s)' },
  'editor.subElem': { FR: 'sous-él.', EN: 'sub-el.' },
  
  // === Contextual Help ===
  'help.editHelp': { FR: 'Modifier l\'aide', EN: 'Edit help' },
  'help.close': { FR: 'Fermer', EN: 'Close' },
  'help.htmlHint': { FR: 'Utilisez du HTML pour formater. Ex: <b>gras</b>, <ul><li>liste</li></ul>', EN: 'Use HTML to format. Ex: <b>bold</b>, <ul><li>list</li></ul>' },
  'help.placeholder': { FR: '<p>Entrez l\'aide contextuelle ici...</p>', EN: '<p>Enter contextual help here...</p>' },
  'help.localHelp': { FR: 'AIDE LOCALE (maquette)', EN: 'LOCAL HELP (mockup)' },
  'help.globalHelp': { FR: 'AIDE GLOBALE (studio)', EN: 'GLOBAL HELP (studio)' },
  'help.key': { FR: 'Clé', EN: 'Key' },
  'help.cancel': { FR: 'Annuler', EN: 'Cancel' },
  'help.save': { FR: 'Enregistrer', EN: 'Save' },
  'help.noHelpAvailable': { FR: 'Aucune aide disponible.', EN: 'No help available.' },
  'help.createHelp': { FR: 'Créer l\'aide', EN: 'Create help' },
  'help.local': { FR: 'LOCAL', EN: 'LOCAL' },
  'help.global': { FR: 'GLOBAL', EN: 'GLOBAL' },
  'help.updatedOn': { FR: 'Mis à jour le', EN: 'Updated on' },
  'help.deleteLocalHelp': { FR: 'Supprimer l\'aide locale', EN: 'Delete local help' },
  'help.deleteGlobalHelp': { FR: 'Supprimer l\'aide globale', EN: 'Delete global help' },
  'help.deleteConfirm': { FR: 'Supprimer cette aide contextuelle', EN: 'Delete this contextual help' },
  'help.localType': { FR: 'locale (spécifique à cette maquette)', EN: 'local (specific to this mockup)' },
  'help.globalType': { FR: 'globale (studio)', EN: 'global (studio)' },
  'help.frenchContent': { FR: 'Contenu français', EN: 'French content' },
  'help.englishContent': { FR: 'Contenu anglais', EN: 'English content' },
  'help.translation': { FR: 'Traduction', EN: 'Translation' },
  'help.translate': { FR: 'Traduire', EN: 'Translate' },
  'help.translating': { FR: 'Traduction...', EN: 'Translating...' },
  
  // === Tutorial Editor ===
  'tutorial.editor': { FR: 'Éditeur de Tutoriel', EN: 'Tutorial Editor' },
  'tutorial.version': { FR: 'Version', EN: 'Version' },
  'tutorial.chapters': { FR: 'chapitres', EN: 'chapters' },
  'tutorial.chaptersList': { FR: 'Chapitres', EN: 'Chapters' },
  'tutorial.addChapter': { FR: 'Ajouter un chapitre', EN: 'Add a chapter' },
  'tutorial.titleFr': { FR: 'Titre (FR)', EN: 'Title (FR)' },
  'tutorial.titleEn': { FR: 'Titre (EN)', EN: 'Title (EN)' },
  'tutorial.descriptionFr': { FR: 'Description (FR)', EN: 'Description (FR)' },
  'tutorial.descriptionEn': { FR: 'Description (EN)', EN: 'Description (EN)' },
  'tutorial.iconLabel': { FR: 'Icône', EN: 'Icon' },
  'tutorial.translate': { FR: 'Traduire', EN: 'Translate' },
  'tutorial.steps': { FR: 'Étapes', EN: 'Steps' },
  'tutorial.addStep': { FR: 'Ajouter une étape', EN: 'Add a step' },
  'tutorial.noStep': { FR: 'Aucune étape.', EN: 'No step.' },
  'tutorial.clickToAdd': { FR: 'Cliquez sur + pour ajouter.', EN: 'Click + to add.' },
  'tutorial.stepTitleFr': { FR: 'Titre étape (FR)', EN: 'Step title (FR)' },
  'tutorial.stepTitleEn': { FR: 'Titre étape (EN)', EN: 'Step title (EN)' },
  'tutorial.contentFr': { FR: 'Contenu (FR) - HTML supporté', EN: 'Content (FR) - HTML supported' },
  'tutorial.contentEn': { FR: 'Contenu (EN) - HTML supporté', EN: 'Content (EN) - HTML supported' },
  'tutorial.targetElement': { FR: 'Élément cible (optionnel)', EN: 'Target element (optional)' },
  'tutorial.action': { FR: 'Action', EN: 'Action' },
  'tutorial.observe': { FR: 'Observer', EN: 'Observe' },
  'tutorial.click': { FR: 'Cliquer', EN: 'Click' },
  'tutorial.input': { FR: 'Saisir', EN: 'Input' },
  'tutorial.selectStep': { FR: 'Sélectionnez une étape pour l\'éditer', EN: 'Select a step to edit' },
  'tutorial.selectChapter': { FR: 'Sélectionnez un chapitre dans la liste', EN: 'Select a chapter from the list' },
  'tutorial.saving': { FR: 'Enregistrement...', EN: 'Saving...' },
  'tutorial.save': { FR: 'Enregistrer', EN: 'Save' },
  'tutorial.saved': { FR: 'Tutoriel sauvegardé !', EN: 'Tutorial saved!' },
  'tutorial.saveError': { FR: 'Erreur de sauvegarde', EN: 'Save error' },
  'tutorial.translationDone': { FR: 'Traduction terminée !', EN: 'Translation complete!' },
  'tutorial.translationError': { FR: 'Erreur de traduction', EN: 'Translation error' },
  'tutorial.shortDescription': { FR: 'Description courte...', EN: 'Short description...' },
  'tutorial.englishTitle': { FR: 'Titre anglais...', EN: 'English title...' },
  'tutorial.cssSelector': { FR: 'Sélecteur CSS...', EN: 'CSS selector...' },
  'editor.subElementCount': { FR: 'sous-élément', EN: 'sub-element' },
  'editor.subElementsCount': { FR: 'sous-éléments', EN: 'sub-elements' },
  'editor.deleteMapPoint': { FR: 'Supprimer le point de carte', EN: 'Delete map point' },
  'editor.deleteMapPointConfirm': { FR: 'Voulez-vous supprimer le point "{name}" de la carte ?', EN: 'Do you want to delete the point "{name}" from the map?' },
  
  // === Panneau d'édition ===
  'editor.cockpit': { FR: 'Cockpit', EN: 'Cockpit' },
  'editor.domain': { FR: 'Domaine', EN: 'Domain' },
  'editor.element': { FR: 'Élément', EN: 'Element' },
  'editor.subElement': { FR: 'Sous-élément', EN: 'Sub-element' },
  'editor.category': { FR: 'Catégorie', EN: 'Category' },
  'editor.name': { FR: 'Nom', EN: 'Name' },
  'editor.description': { FR: 'Description', EN: 'Description' },
  'editor.status': { FR: 'Statut', EN: 'Status' },
  'editor.value': { FR: 'Valeur', EN: 'Value' },
  'editor.icon': { FR: 'Icône', EN: 'Icon' },
  'editor.color': { FR: 'Couleur', EN: 'Color' },
  'editor.add': { FR: 'Ajouter', EN: 'Add' },
  'editor.remove': { FR: 'Supprimer', EN: 'Remove' },
  'editor.save': { FR: 'Enregistrer', EN: 'Save' },
  'editor.cancel': { FR: 'Annuler', EN: 'Cancel' },
  'editor.preferences': { FR: 'Préférences d\'affichage', EN: 'Display preferences' },
  
  // === Zoom ===
  'zoom.fullscreen': { FR: 'Mode plein écran', EN: 'Fullscreen mode' },
  'zoom.exitFullscreen': { FR: 'Quitter le plein écran', EN: 'Exit fullscreen' },
  'zoom.center': { FR: 'Recaler la vue', EN: 'Reset view position' },
  'zoom.fitToWindow': { FR: 'Ajuster à la fenêtre (double-clic: 100%)', EN: 'Fit to window (double-click: 100%)' },
  
  // === Timeline des dates ===
  'dateTimeline.show': { FR: 'Afficher les dates', EN: 'Show dates' },
  'dateTimeline.hide': { FR: 'Masquer les dates', EN: 'Hide dates' },
  
  // === Statuts ===
  'status.ok': { FR: 'OK', EN: 'OK' },
  'status.minor': { FR: 'Mineur', EN: 'Minor' },
  'status.critical': { FR: 'Critique', EN: 'Critical' },
  'status.fatal': { FR: 'Fatal', EN: 'Fatal' },
  'status.disconnected': { FR: 'Déconnecté', EN: 'Disconnected' },
  'status.information': { FR: 'Information', EN: 'Information' },
  'status.inherited': { FR: 'Hérité', EN: 'Inherited' },
  
  // === Templates de vues ===
  'template.standard': { FR: 'Standard', EN: 'Standard' },
  'template.grid': { FR: 'Grille', EN: 'Grid' },
  'template.map': { FR: 'Carte', EN: 'Map' },
  'template.background': { FR: 'Background', EN: 'Background' },
  'template.hoursTracking': { FR: 'Suivi des heures', EN: 'Hours Tracking' },
  'template.library': { FR: 'Bibliothèque', EN: 'Library' },
  'template.dataHistory': { FR: 'Historique données', EN: 'Data History' },
  
  // === Historique des données ===
  'dataHistory.title': { FR: 'Historique des données', EN: 'Data History' },
  'dataHistory.addDate': { FR: 'Ajouter une date', EN: 'Add date' },
  'dataHistory.initWithCurrent': { FR: 'Initialiser avec valeurs actuelles', EN: 'Initialize with current values' },
  'dataHistory.subElement': { FR: 'Sous-élément', EN: 'Sub-element' },
  'dataHistory.location': { FR: 'Localisation', EN: 'Location' },
  'dataHistory.linked': { FR: 'liés', EN: 'linked' },
  'dataHistory.deleteColumn': { FR: 'Supprimer cette colonne', EN: 'Delete this column' },
  'dataHistory.currentData': { FR: 'Données actuelles', EN: 'Current data' },
  'dataHistory.selectDate': { FR: 'Sélectionner la date d\'affichage', EN: 'Select display date' },
  'dataHistory.noData': { FR: 'Aucune donnée pour cette date', EN: 'No data for this date' },
  'dataHistory.export': { FR: 'Exporter', EN: 'Export' },
  'dataHistory.import': { FR: 'Importer', EN: 'Import' },
  'dataHistory.active': { FR: 'Active', EN: 'Active' },
  'dataHistory.inactive': { FR: 'Inactive', EN: 'Inactive' },
  
  // === Modales ===
  'modal.confirm': { FR: 'Confirmer', EN: 'Confirm' },
  'modal.cancel': { FR: 'Annuler', EN: 'Cancel' },
  'modal.close': { FR: 'Fermer', EN: 'Close' },
  'modal.yes': { FR: 'Oui', EN: 'Yes' },
  'modal.no': { FR: 'Non', EN: 'No' },
  'modal.ok': { FR: 'OK', EN: 'OK' },
  'modal.save': { FR: 'Enregistrer', EN: 'Save' },
  'modal.delete': { FR: 'Supprimer', EN: 'Delete' },
  'modal.areYouSure': { FR: 'Êtes-vous sûr ?', EN: 'Are you sure?' },
  'modal.create': { FR: 'Créer', EN: 'Create' },
  'modal.newMockup': { FR: 'Nouvelle maquette', EN: 'New mockup' },
  'modal.mockupName': { FR: 'Nom de la maquette', EN: 'Mockup name' },
  'modal.newFolder': { FR: 'Nouveau répertoire', EN: 'New folder' },
  'modal.folderName': { FR: 'Nom du répertoire', EN: 'Folder name' },
  'modal.duplicateMockup': { FR: 'Dupliquer la maquette', EN: 'Duplicate mockup' },
  'modal.newMockupName': { FR: 'Nouveau nom de la maquette', EN: 'New mockup name' },
  'modal.deleteMockup': { FR: 'Supprimer la maquette', EN: 'Delete mockup' },
  'modal.deleteMockupConfirm': { FR: 'Êtes-vous sûr de vouloir supprimer cette maquette ? Cette action est irréversible.', EN: 'Are you sure you want to delete this mockup? This action cannot be undone.' },
  'modal.renameFolder': { FR: 'Renommer le répertoire', EN: 'Rename folder' },
  'modal.publishMockup': { FR: 'Publier la maquette', EN: 'Publish mockup' },
  'modal.welcomeMessage': { FR: 'Message d\'accueil (optionnel)', EN: 'Welcome message (optional)' },
  'modal.welcomeMessagePlaceholder': { FR: 'Ce message s\'affichera à chaque ouverture du cockpit publié...', EN: 'This message will be displayed each time the published cockpit is opened...' },
  'modal.welcomeMessageHint': { FR: 'Les visiteurs verront ce message dans un popup avant d\'accéder au cockpit.', EN: 'Visitors will see this message in a popup before accessing the cockpit.' },
  'modal.editWelcomeMessage': { FR: 'Message d\'accueil', EN: 'Welcome message' },
  'modal.publishWithMessage': { FR: 'Publier avec message', EN: 'Publish with message' },
  'modal.publishWithoutMessage': { FR: 'Publier sans message', EN: 'Publish without message' },
  'modal.messageForVisitors': { FR: 'Message affiché aux visiteurs', EN: 'Message displayed to visitors' },
  'modal.leaveEmptyToRemove': { FR: 'Laissez vide pour supprimer le message d\'accueil.', EN: 'Leave empty to remove the welcome message.' },
  'modal.changeMyName': { FR: 'Modifier mon nom', EN: 'Change my name' },
  'modal.newName': { FR: 'Nouveau nom', EN: 'New name' },
  'modal.enterYourName': { FR: 'Entrez votre nom', EN: 'Enter your name' },
  'modal.changeMyEmail': { FR: 'Modifier mon email', EN: 'Change my email' },
  'modal.newEmail': { FR: 'Nouvel email', EN: 'New email' },
  'modal.enterYourEmail': { FR: 'Entrez votre email', EN: 'Enter your email' },
  'modal.changePassword': { FR: 'Changer le mot de passe', EN: 'Change password' },
  'modal.currentPassword': { FR: 'Mot de passe actuel', EN: 'Current password' },
  'modal.oldPassword': { FR: 'Ancien mot de passe', EN: 'Old password' },
  'modal.newPassword': { FR: 'Nouveau mot de passe', EN: 'New password' },
  'modal.enterOldPassword': { FR: 'Entrez votre ancien mot de passe', EN: 'Enter your old password' },
  'modal.enterNewPassword': { FR: 'Entrez votre nouveau mot de passe', EN: 'Enter your new password' },
  'modal.confirmNewPassword': { FR: 'Confirmez votre nouveau mot de passe', EN: 'Confirm your new password' },
  'modal.passwordsNotMatch': { FR: 'Les mots de passe ne correspondent pas', EN: 'Passwords do not match' },
  'modal.change': { FR: 'Changer', EN: 'Change' },
  'modal.saving': { FR: 'Enregistrement...', EN: 'Saving...' },
  'modal.exportMockup': { FR: 'Exporter la maquette', EN: 'Export mockup' },
  'modal.exportDescription': { FR: 'Choisissez le nom du fichier à exporter. Le fichier sera téléchargé dans votre dossier de téléchargements par défaut.', EN: 'Choose the file name for export. The file will be downloaded to your default downloads folder.' },
  'modal.fileName': { FR: 'Nom du fichier', EN: 'File name' },
  'modal.jsonExtension': { FR: 'L\'extension .json sera ajoutée automatiquement', EN: 'The .json extension will be added automatically' },
  'modal.copyName': { FR: 'Nom de la copie', EN: 'Copy name' },
  
  // === Messages ===
  'msg.loading': { FR: 'Chargement...', EN: 'Loading...' },
  'msg.saving': { FR: 'Enregistrement...', EN: 'Saving...' },
  'msg.error': { FR: 'Erreur', EN: 'Error' },
  'msg.success': { FR: 'Succès', EN: 'Success' },
  'msg.noResults': { FR: 'Aucun résultat', EN: 'No results' },
  
  // === Tutoriel ===
  'tutorial.start': { FR: 'Tutoriel', EN: 'Tutorial' },
  'tutorial.review': { FR: 'Revoir le tutoriel', EN: 'Review tutorial' },
  'tutorial.skip': { FR: 'Passer le tutoriel', EN: 'Skip tutorial' },
  'tutorial.next': { FR: 'Suivant', EN: 'Next' },
  'tutorial.previous': { FR: 'Précédent', EN: 'Previous' },
  'tutorial.finish': { FR: 'Terminer', EN: 'Finish' },
  'tutorial.chapter': { FR: 'Chapitre', EN: 'Chapter' },
  'tutorial.allChapters': { FR: 'Voir tous les chapitres', EN: 'View all chapters' },
  'tutorial.clickToContinue': { FR: 'Cliquez sur l\'élément surligné pour continuer', EN: 'Click on the highlighted element to continue' },
  
  // === Gestion des langues ===
  'lang.title': { FR: 'Gestion des langues', EN: 'Language Management' },
  'lang.key': { FR: 'Clé', EN: 'Key' },
  'lang.french': { FR: 'Français', EN: 'French' },
  'lang.english': { FR: 'Anglais', EN: 'English' },
  'lang.translate': { FR: 'Traduire', EN: 'Translate' },
  'lang.translateAll': { FR: 'Traduire tout', EN: 'Translate all' },
  'lang.reset': { FR: 'Réinitialiser', EN: 'Reset' },
  'lang.search': { FR: 'Rechercher une clé...', EN: 'Search key...' },
  
  // === Footer ===
  'footer.version': { FR: 'Version', EN: 'Version' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
  translations: Record<string, { FR: string; EN: string }>;
  customTranslations: Record<string, { FR: string; EN: string }>;
  updateTranslation: (key: string, lang: Language, value: string) => void;
  saveTranslations: () => Promise<boolean>;
  loadTranslations: () => Promise<void>;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { token } = useAuthStore();
  const [language, setLanguageState] = useState<Language>('FR');
  const [customTranslations, setCustomTranslations] = useState<Record<string, { FR: string; EN: string }>>({});
  const [isLoading, setIsLoading] = useState(false);
  
  // Charger la langue depuis localStorage au démarrage
  useEffect(() => {
    const savedLang = localStorage.getItem('studio-language') as Language;
    if (savedLang && (savedLang === 'FR' || savedLang === 'EN')) {
      setLanguageState(savedLang);
    }
  }, []);
  
  // Changer la langue
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('studio-language', lang);
  }, []);
  
  // Fonction de traduction
  const t = useCallback((key: string, fallback?: string): string => {
    // Chercher d'abord dans les traductions personnalisées
    if (customTranslations[key]?.[language]) {
      return customTranslations[key][language];
    }
    // Puis dans les traductions par défaut
    if (DEFAULT_TRANSLATIONS[key]?.[language]) {
      return DEFAULT_TRANSLATIONS[key][language];
    }
    // Fallback ou clé
    return fallback || key;
  }, [language, customTranslations]);
  
  // Fusionner les traductions
  const translations = { ...DEFAULT_TRANSLATIONS, ...customTranslations };
  
  // Mettre à jour une traduction
  const updateTranslation = useCallback((key: string, lang: Language, value: string) => {
    setCustomTranslations(prev => ({
      ...prev,
      [key]: {
        ...DEFAULT_TRANSLATIONS[key],
        ...prev[key],
        [lang]: value
      }
    }));
  }, []);
  
  // Charger les traductions personnalisées depuis l'API
  const loadTranslations = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/translations', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.translations) {
          setCustomTranslations(data.translations);
        }
      }
    } catch (error) {
      console.error('[Language] Erreur chargement traductions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);
  
  // Sauvegarder les traductions personnalisées
  const saveTranslations = useCallback(async (): Promise<boolean> => {
    if (!token) return false;
    
    try {
      const response = await fetch('/api/translations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ translations: customTranslations })
      });
      
      return response.ok;
    } catch (error) {
      console.error('[Language] Erreur sauvegarde traductions:', error);
      return false;
    }
  }, [token, customTranslations]);
  
  // Charger les traductions au démarrage
  useEffect(() => {
    loadTranslations();
  }, [loadTranslations]);
  
  return (
    <LanguageContext.Provider value={{
      language,
      setLanguage,
      t,
      translations,
      customTranslations,
      updateTranslation,
      saveTranslations,
      loadTranslations,
      isLoading
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
