class TaskManager {
	constructor() {
		this.tasks = [];
		// 🔧 MODIFICATION PRINCIPALE : Détection automatique de l'environnement
		this.apiUrl = this.getApiUrl();
		this.draggedTask = null;
		this.offlineMode = false;
		this.hasLoadedBefore = false;
		this.evaluationAnswers = {
			importance: {},
			urgency: {}
		};
		this.currentEvaluation = null;
		
		// Nouvelles propriétés pour l'édition
		this.editEvaluationAnswers = {
			importance: {},
			urgency: {}
		};
		this.editCurrentEvaluation = null;
		this.editingTaskId = null;
		
		// Configuration des questions personnalisables
		this.questionConfig = this.loadQuestionConfig();
		
		this.init();
	}

	// 🆕 NOUVELLE MÉTHODE : Détection automatique de l'URL API
	getApiUrl() {
		// Si on est en développement local
		if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
			return 'http://localhost:5000/api/tasks';
		}
		
		// Si on est en production, construire l'URL dynamiquement
		// Remplacez 'votre-app-name' par le nom réel de votre app Render
		const protocol = window.location.protocol; // https: ou http:
		const hostname = window.location.hostname;
		
		// Si c'est un déploiement Render, utiliser l'URL backend
		if (hostname.includes('vercel.app') || hostname.includes('netlify.app')) {
			// Frontend déployé séparément, pointer vers le backend Render
			return 'https://gestionnaire-taches.onrender.com/api/tasks';
		}
		
		// Si tout est déployé ensemble sur Render
		return `${protocol}//${hostname}/api/tasks`;
	}

	// 🆕 NOUVELLE MÉTHODE : Test de connectivité API au démarrage
	async testApiConnection() {
		try {
			console.log('Test de connexion API vers:', this.apiUrl);
			const response = await fetch(this.apiUrl, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
				},
				// Timeout de 10 secondes
				signal: AbortSignal.timeout(10000)
			});

			if (response.ok) {
				console.log('✅ Connexion API réussie');
				return true;
			} else {
				console.warn('⚠️ API accessible mais erreur:', response.status);
				return false;
			}
		} catch (error) {
			console.error('❌ Échec de connexion API:', error.message);
			return false;
		}
	}

	async init() {
		this.bindEvents();
		this.setupDragAndDrop();
		this.setupModal();
		this.generateQuestions();
		
		// Tester la connexion avant de charger les tâches
		const apiConnected = await this.testApiConnection();
		if (!apiConnected) {
			this.showStatus('Mode hors ligne - Serveur non accessible', 'warning');
			this.offlineMode = true;
		}
		
		this.loadTasks();
	}

	// 🔧 MODIFICATION : Amélioration de la gestion d'erreur dans loadTasks
	async loadTasks() {
		// Si on sait déjà qu'on est hors ligne, utiliser les données de démo directement
		if (this.offlineMode) {
			this.loadDemoTasks();
			return;
		}

		try {
			console.log('Chargement des tâches depuis:', this.apiUrl);
			
			const response = await fetch(this.apiUrl, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
				},
				// Timeout de 15 secondes
				signal: AbortSignal.timeout(15000)
			});

			if (!response.ok) {
				throw new Error(`Erreur HTTP: ${response.status} - ${response.statusText}`);
			}

			const data = await response.json();
			
			if (data.success) {
				this.tasks = data.tasks || [];
				
				this.tasks.forEach(task => {
					if (!task.status) {
						if (task.completed) {
							task.status = 'done';
						} else {
							task.status = 'todo';
						}
					}
				});
				
				console.log('✅ Tâches chargées depuis l\'API:', this.tasks.length);
				this.renderTasks();
				
				if (this.tasks.length > 0 && !this.hasLoadedBefore) {
					this.showStatus(`${this.tasks.length} tâche(s) chargée(s)`, 'success');
					this.hasLoadedBefore = true;
				}

				// Marquer comme connecté si le chargement réussit
				this.offlineMode = false;
			} else {
				console.error('Erreur API:', data.error);
				this.showStatus('Erreur lors du chargement: ' + (data.error || 'Erreur inconnue'), 'error');
				this.loadDemoTasks();
			}
		} catch (error) {
			console.error('❌ Erreur lors du chargement des tâches:', error);
			
			// Messages d'erreur plus informatifs
			let errorMessage = 'Impossible de se connecter à l\'API.';
			if (error.name === 'TimeoutError') {
				errorMessage = 'Délai d\'attente dépassé. Serveur trop lent ou indisponible.';
			} else if (error.message.includes('Failed to fetch')) {
				errorMessage = 'Erreur de réseau. Vérifiez votre connexion internet.';
			} else if (error.message.includes('CORS')) {
				errorMessage = 'Erreur CORS. Configuration serveur requise.';
			}
			
			this.showStatus(errorMessage + ' Mode démonstration activé.', 'warning');
			this.offlineMode = true;
			this.loadDemoTasks();
		}
	}

	// 🆕 NOUVELLE MÉTHODE : Chargement des données de démonstration
	loadDemoTasks() {
		this.tasks = [
			{
				id: -1,
				title: "Présentation client importante",
				description: "Préparer la présentation pour le client majeur",
				dueDate: "2025-08-05",
				completed: false,
				status: 'todo',
				createdAt: new Date().toISOString(),
				eisenhowerEvaluation: {
					isImportant: true,
					isUrgent: true,
					importanceScore: 0.8,
					urgencyScore: 0.9
				}
			},
			{
				id: -2,
				title: "Formation équipe",
				description: "Organiser la formation pour l'équipe",
				dueDate: "2025-09-15",
				completed: false,
				status: 'inprogress',
				createdAt: new Date().toISOString(),
				eisenhowerEvaluation: {
					isImportant: true,
					isUrgent: false,
					importanceScore: 0.7,
					urgencyScore: 0.3
				}
			},
			{
				id: -3,
				title: "Répondre aux emails",
				description: "Traiter la boîte de réception",
				dueDate: "2025-08-01",
				completed: false,
				status: 'todo',
				createdAt: new Date().toISOString(),
				eisenhowerEvaluation: {
					isImportant: false,
					isUrgent: true,
					importanceScore: 0.2,
					urgencyScore: 0.8
				}
			}
		];
		this.renderTasks();
	}

	// 🔧 MODIFICATION : Amélioration de la gestion d'erreur dans addTask
	async addTask() {
		const form = document.getElementById('taskForm');
		const addBtn = document.getElementById('addTaskBtn');
		const formData = new FormData(form);
		
		const taskData = {
			title: formData.get('title'),
			description: formData.get('description'),
			dueDate: formData.get('dueDate'),
			priority: 'moyenne',
			estimatedDuration: formData.get('estimatedDuration'),
			startDeadline: document.getElementById('startDeadline').value
		};

		// Ajouter les données d'évaluation
		if (this.currentEvaluation) {
			taskData.eisenhowerEvaluation = this.currentEvaluation;
		}

		addBtn.disabled = true;
		addBtn.textContent = '⏳ Création...';

		// Mode hors ligne
		if (this.offlineMode) {
			const newTask = {
				...taskData,
				id: Date.now(), // ID temporaire
				completed: false,
				status: 'todo',
				createdAt: new Date().toISOString()
			};
			
			this.tasks.push(newTask);
			this.renderTasks();
			
			document.getElementById('taskModal').classList.remove('show');
			document.body.style.overflow = 'auto';
			form.reset();
			this.resetEvaluation();
			
			this.showStatus('Tâche créée en mode hors ligne', 'warning');
			addBtn.disabled = true;
			addBtn.textContent = '➕ Créer la tâche';
			return;
		}

		try {
			const response = await fetch(this.apiUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(taskData),
				signal: AbortSignal.timeout(10000)
			});

			if (!response.ok) {
				throw new Error(`Erreur HTTP: ${response.status} - ${response.statusText}`);
			}

			const data = await response.json();
			
			if (data.success) {
				document.getElementById('taskModal').classList.remove('show');
				document.body.style.overflow = 'auto';
				
				form.reset();
				this.resetEvaluation();
				
				this.showStatus('Tâche créée avec succès !', 'success');
				await this.loadTasks();
				
				setTimeout(() => {
					const newTask = document.querySelector(`[data-task-id="${data.task.id}"]`);
					if (newTask) {
						newTask.classList.add('new-task');
						setTimeout(() => {
							newTask.classList.remove('new-task');
						}, 300);
					}
				}, 100);

			} else {
				this.showStatus('Erreur lors de la création: ' + (data.error || 'Erreur inconnue'), 'error');
			}
		} catch (error) {
			console.error('Erreur lors de la création de la tâche:', error);
			
			let errorMessage = 'Erreur de connexion lors de la création.';
			if (error.name === 'TimeoutError') {
				errorMessage = 'Délai d\'attente dépassé lors de la création.';
			}
			
			this.showStatus(errorMessage, 'error');
		} finally {
			addBtn.disabled = true;
			addBtn.textContent = '➕ Créer la tâche';
		}
	}

	// 🆕 NOUVELLE MÉTHODE : Vérification périodique de la reconnexion
	startConnectionCheck() {
		if (this.connectionCheckInterval) {
			clearInterval(this.connectionCheckInterval);
		}

		this.connectionCheckInterval = setInterval(async () => {
			if (this.offlineMode) {
				const isConnected = await this.testApiConnection();
				if (isConnected) {
					this.offlineMode = false;
					this.showStatus('Connexion rétablie !', 'success');
					this.loadTasks();
					clearInterval(this.connectionCheckInterval);
				}
			}
		}, 30000); // Vérifier toutes les 30 secondes
	}

	// Le reste du code reste identique...
	// [Copiez tout le reste de votre code existant ici]

	calculateStartDeadline(dueDate, estimatedDuration) {
		if (!dueDate || !estimatedDuration) {
			return null;
		}
		
		const due = new Date(dueDate);
		const durationInDays = Math.ceil(estimatedDuration / 8); // 8h = 1 jour de travail
		const startDeadline = new Date(due);
		startDeadline.setDate(due.getDate() - durationInDays);
		
		return startDeadline.toISOString().split('T')[0];
	}

	calculateTimeBasedUrgency(startDeadline) {
		if (!startDeadline) {
			return 0; // Pas d'urgence si pas de date limite
		}
		
		const now = new Date();
		const deadline = new Date(startDeadline);
		const diffInDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
		
		if (diffInDays < 0) return 1; // Dépassé = urgence maximale
		if (diffInDays <= 1) return 0.9; // Très urgent
		if (diffInDays <= 3) return 0.7; // Urgent
		if (diffInDays <= 7) return 0.5; // Modérément urgent
		if (diffInDays <= 14) return 0.3; // Peu urgent
		return 0.1; // Pas urgent
	}

	getUrgencyLabel(urgencyScore) {
		if (urgencyScore >= 0.8) return { text: 'CRITIQUE', class: 'urgency-critical' };
		if (urgencyScore >= 0.6) return { text: 'ÉLEVÉE', class: 'urgency-high' };
		if (urgencyScore >= 0.4) return { text: 'MOYENNE', class: 'urgency-medium' };
		return { text: 'BASSE', class: 'urgency-low' };
	}

	loadQuestionConfig() {
		// Charger la configuration depuis le stockage local ou utiliser les valeurs par défaut
		const savedConfig = localStorage.getItem('eisenhowerQuestions');
		if (savedConfig) {
			try {
				return JSON.parse(savedConfig);
			} catch (e) {
				console.error('Erreur lors du chargement de la configuration:', e);
			}
		}
		
		// Configuration par défaut avec nouvelles questions d'urgence
		return {
			importance: [
				"Cette tâche contribue-t-elle directement à mes objectifs principaux ?",
				"Y aurait-il des conséquences négatives importantes si je ne la fais pas du tout ?",
				"Cette tâche m'aide-t-elle à avancer vers mes priorités à long terme ?",
				"Cette tâche a-t-elle un impact positif significatif sur mon travail/ma vie ?",
				"Suis-je la personne la mieux placée pour accomplir cette tâche ?"
			],
			urgency: [
				"La date limite pour commencer peut-elle être reportée facilement ?",
				"Y a-t-il une flexibilité sur le timing de cette tâche ?",
				"Cette tâche peut-elle attendre sans conséquences ?",
				"Le délai est-il négociable avec les parties prenantes ?",
				"Puis-je reporter le début de cette tâche de quelques jours ?"
			]
		};
	}

	saveQuestionConfig() {
		localStorage.setItem('eisenhowerQuestions', JSON.stringify(this.questionConfig));
	}

	generateQuestions() {
		this.generateQuestionsForModal('questionsGrid', 'taskModal');
		this.generateQuestionsForModal('editQuestionsGrid', 'editTaskModal');
	}

	generateQuestionsForModal(containerId, modalType) {
		const container = document.getElementById(containerId);
		container.innerHTML = '';

		// Créer les catégories de questions
		const importanceCategory = this.createQuestionCategory('importance', '📈 Évaluation de l\'IMPORTANCE', modalType);
		const urgencyCategory = this.createQuestionCategory('urgency', '⚡ Évaluation de l\'URGENCE', modalType);

		container.appendChild(importanceCategory);
		container.appendChild(urgencyCategory);
	}

	createQuestionCategory(type, title, modalType) {
		const category = document.createElement('div');
		category.className = `question-category ${type}-questions`;
		
		const header = document.createElement('h4');
		header.textContent = title;
		category.appendChild(header);

		// Ajouter les questions pour cette catégorie
		this.questionConfig[type].forEach((questionText, index) => {
			const questionItem = this.createQuestionItem(type, index + 1, questionText, modalType);
			category.appendChild(questionItem);
		});

		return category;
	}

	createQuestionItem(type, id, questionText, modalType) {
		const item = document.createElement('div');
		item.className = 'question-item';
		item.dataset.question = type;
		item.dataset.id = id;

		item.innerHTML = `
			<div class="question-text">${questionText}</div>
			<div class="yes-no-buttons">
				<button type="button" class="btn-yes" data-answer="yes">Oui</button>
				<button type="button" class="btn-no" data-answer="no">Non</button>
			</div>
		`;

		// Ajouter les événements
		const buttons = item.querySelectorAll('.btn-yes, .btn-no');
		buttons.forEach(button => {
			button.addEventListener('click', () => {
				buttons.forEach(btn => btn.classList.remove('selected'));
				button.classList.add('selected');
				
				if (modalType === 'taskModal') {
					this.evaluationAnswers[type][id] = button.dataset.answer === 'yes';
					this.calculateEvaluationResult();
					this.checkFormValidity();
				} else {
					this.editEvaluationAnswers[type][id] = button.dataset.answer === 'yes';
					this.calculateEditEvaluationResult();
				}
			});
		});

		return item;
	}

	setupModal() {
		const modal = document.getElementById('taskModal');
		const addBtn = document.getElementById('addTaskModalBtn');
		const closeBtn = document.getElementById('closeModalBtn');
		const cancelBtn = document.getElementById('cancelBtn');

		// Ouvrir la modal de création
		addBtn.addEventListener('click', () => {
			modal.classList.add('show');
			document.body.style.overflow = 'hidden';
		});

		// Fermer la modal de création
		const closeModal = () => {
			modal.classList.remove('show');
			document.body.style.overflow = 'auto';
			this.resetForm();
		};

		closeBtn.addEventListener('click', closeModal);
		cancelBtn.addEventListener('click', closeModal);

		// Fermer en cliquant à l'extérieur
		modal.addEventListener('click', (e) => {
			if (e.target === modal) {
				closeModal();
			}
		});

		// Gestion de la modal légende
		const legendModal = document.getElementById('legendModal');
		const legendBtn = document.getElementById('legendBtn');
		const closeLegendBtn = document.getElementById('closeLegendBtn');

		legendBtn.addEventListener('click', () => {
			legendModal.classList.add('show');
			document.body.style.overflow = 'hidden';
		});

		const closeLegendModal = () => {
			legendModal.classList.remove('show');
			document.body.style.overflow = 'auto';
		};

		closeLegendBtn.addEventListener('click', closeLegendModal);
		legendModal.addEventListener('click', (e) => {
			if (e.target === legendModal) {
				closeLegendModal();
			}
		});

		// Gestion de la modal d'édition
		const editModal = document.getElementById('editTaskModal');
		const closeEditBtn = document.getElementById('closeEditModalBtn');
		const cancelEditBtn = document.getElementById('cancelEditBtn');

		const closeEditModal = () => {
			editModal.classList.remove('show');
			document.body.style.overflow = 'auto';
			this.resetEditForm();
		};

		closeEditBtn.addEventListener('click', closeEditModal);
		cancelEditBtn.addEventListener('click', closeEditModal);
		editModal.addEventListener('click', (e) => {
			if (e.target === editModal) {
				closeEditModal();
			}
		});

		// Gestion de la modal de configuration
		this.setupSettingsModal();

		// Gérer Escape pour toutes les modals
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				if (modal.classList.contains('show')) {
					closeModal();
				} else if (legendModal.classList.contains('show')) {
					closeLegendModal();
				} else if (editModal.classList.contains('show')) {
					closeEditModal();
				} else if (document.getElementById('settingsModal').classList.contains('show')) {
					this.closeSettingsModal();
				}
			}
		});
	}

	setupSettingsModal() {
		const settingsModal = document.getElementById('settingsModal');
		const settingsBtn = document.getElementById('settingsBtn');
		const closeSettingsBtn = document.getElementById('closeSettingsBtn');
		const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
		const saveSettingsBtn = document.getElementById('saveSettingsBtn');
		const resetQuestionsBtn = document.getElementById('resetQuestionsBtn');
		const addImportanceBtn = document.getElementById('addImportanceQuestion');
		const addUrgencyBtn = document.getElementById('addUrgencyQuestion');

		settingsBtn.addEventListener('click', () => {
			this.openSettingsModal();
		});

		closeSettingsBtn.addEventListener('click', () => {
			this.closeSettingsModal();
		});

		cancelSettingsBtn.addEventListener('click', () => {
			this.closeSettingsModal();
		});

		saveSettingsBtn.addEventListener('click', () => {
			this.saveQuestionSettings();
		});

		resetQuestionsBtn.addEventListener('click', () => {
			this.resetToDefaultQuestions();
		});

		addImportanceBtn.addEventListener('click', () => {
			this.addNewQuestion('importance');
		});

		addUrgencyBtn.addEventListener('click', () => {
			this.addNewQuestion('urgency');
		});

		settingsModal.addEventListener('click', (e) => {
			if (e.target === settingsModal) {
				this.closeSettingsModal();
			}
		});
	}

	openSettingsModal() {
		this.generateSettingsInterface();
		document.getElementById('settingsModal').classList.add('show');
		document.body.style.overflow = 'hidden';
	}

	closeSettingsModal() {
		document.getElementById('settingsModal').classList.remove('show');
		document.body.style.overflow = 'auto';
	}

	generateSettingsInterface() {
		this.generateQuestionConfig('importance');
		this.generateQuestionConfig('urgency');
	}

	generateQuestionConfig(type) {
		const container = document.getElementById(`${type}QuestionsConfig`);
		container.innerHTML = '';

		this.questionConfig[type].forEach((question, index) => {
			const configItem = document.createElement('div');
			configItem.className = 'question-config-item';
			
			// Déterminer si le bouton de suppression doit être désactivé
			const canDelete = this.questionConfig[type].length > 3;
			
			configItem.innerHTML = `
				<input type="text" value="${question}" data-type="${type}" data-index="${index}">
				<div class="question-config-actions">
					<button type="button" 
							class="btn-small btn-remove" 
							onclick="taskManager.removeQuestion('${type}', ${index})"
							${!canDelete ? 'disabled title="Minimum 3 questions requises"' : ''}>
						🗑️
					</button>
				</div>
			`;
			container.appendChild(configItem);
		});
	}

	addNewQuestion(type) {
		this.questionConfig[type].push('Nouvelle question...');
		this.generateQuestionConfig(type);
	}

	removeQuestion(type, index) {
		if (this.questionConfig[type].length <= 3) {
			this.showStatus('Vous devez conserver au minimum 3 questions par catégorie.', 'warning');
			return;
		}
		
		this.questionConfig[type].splice(index, 1);
		this.generateQuestionConfig(type);
	}

	saveQuestionSettings() {
		// Récupérer les valeurs des inputs
		const importanceInputs = document.querySelectorAll('#importanceQuestionsConfig input');
		const urgencyInputs = document.querySelectorAll('#urgencyQuestionsConfig input');

		// Mettre à jour la configuration
		this.questionConfig.importance = Array.from(importanceInputs).map(input => input.value.trim()).filter(q => q.length > 0);
		this.questionConfig.urgency = Array.from(urgencyInputs).map(input => input.value.trim()).filter(q => q.length > 0);

		// Valider qu'il y a au moins 3 questions par catégorie
		if (this.questionConfig.importance.length < 3 || this.questionConfig.urgency.length < 3) {
			this.showStatus('Chaque catégorie doit contenir au moins 3 questions.', 'error');
			return;
		}

		// Sauvegarder et régénérer
		this.saveQuestionConfig();
		this.generateQuestions();
		this.closeSettingsModal();
		this.showStatus('Configuration sauvegardée avec succès !', 'success');

		// Réinitialiser les réponses existantes
		this.resetEvaluation();
		this.resetEditEvaluation();
	}

	resetToDefaultQuestions() {
		if (confirm('Êtes-vous sûr de vouloir restaurer les questions par défaut ? Vos modifications seront perdues.')) {
			// Supprimer la configuration sauvegardée
			localStorage.removeItem('eisenhowerQuestions');
			
			// Recharger la configuration par défaut
			this.questionConfig = this.loadQuestionConfig();
			
			// Régénérer l'interface
			this.generateSettingsInterface();
			this.generateQuestions();
			
			this.showStatus('Questions restaurées par défaut.', 'success');
		}
	}

	resetForm() {
		document.getElementById('taskForm').reset();
		this.resetEvaluation();
	}

	bindEvents() {
		document.getElementById('taskForm').addEventListener('submit', (e) => {
			e.preventDefault();
			this.addTask();
		});
		
		document.getElementById('editTaskForm').addEventListener('submit', (e) => {
			e.preventDefault();
			this.saveEditedTask();
		});
		
		// Vérifier la validité du formulaire au changement du titre
		document.getElementById('title').addEventListener('input', () => {
			this.checkFormValidity();
		});

		// Calcul automatique de la date limite de commencement
		document.getElementById('dueDate').addEventListener('change', this.updateStartDeadline.bind(this));
		document.getElementById('estimatedDuration').addEventListener('input', this.updateStartDeadline.bind(this));

		document.getElementById('editDueDate').addEventListener('change', this.updateEditStartDeadline.bind(this));
		document.getElementById('editEstimatedDuration').addEventListener('input', this.updateEditStartDeadline.bind(this));
	}

	updateStartDeadline() {
		const dueDate = document.getElementById('dueDate').value;
		const duration = document.getElementById('estimatedDuration').value;
		const startDeadlineField = document.getElementById('startDeadline');
		
		const calculated = this.calculateStartDeadline(dueDate, duration);
		startDeadlineField.value = calculated || '';
		
		if (calculated) {
			const urgency = this.calculateTimeBasedUrgency(calculated);
			const urgencyLabel = this.getUrgencyLabel(urgency);
			
			// Recalculer l'évaluation avec la nouvelle urgence temporelle
			this.calculateEvaluationResult();
		}
	}

	updateEditStartDeadline() {
		const dueDate = document.getElementById('editDueDate').value;
		const duration = document.getElementById('editEstimatedDuration').value;
		const startDeadlineField = document.getElementById('editStartDeadline');
		
		const calculated = this.calculateStartDeadline(dueDate, duration);
		startDeadlineField.value = calculated || '';
		
		if (calculated) {
			this.calculateEditEvaluationResult();
		}
	}

	checkFormValidity() {
		const importanceAnswers = Object.values(this.evaluationAnswers.importance);
		const urgencyAnswers = Object.values(this.evaluationAnswers.urgency);
		const titleFilled = document.getElementById('title').value.trim() !== '';
		
		// Vérifier qu'on a au moins 3 réponses dans chaque catégorie et un titre
		const hasEnoughAnswers = importanceAnswers.length >= Math.min(3, this.questionConfig.importance.length) && 
								urgencyAnswers.length >= Math.min(3, this.questionConfig.urgency.length);
		const canSubmit = hasEnoughAnswers && titleFilled && this.currentEvaluation;
		
		document.getElementById('addTaskBtn').disabled = !canSubmit;
	}

	resetEvaluation() {
		this.evaluationAnswers = {
			importance: {},
			urgency: {}
		};
		
		// Désélectionner tous les boutons
		document.querySelectorAll('#taskModal .btn-yes, #taskModal .btn-no').forEach(btn => {
			btn.classList.remove('selected');
		});
		
		// Masquer le résultat
		document.getElementById('evaluationResult').classList.add('hidden');
		this.currentEvaluation = null;
		document.getElementById('addTaskBtn').disabled = true;
	}

	calculateEvaluationResult() {
		const importanceAnswers = Object.values(this.evaluationAnswers.importance);
		const urgencyAnswers = Object.values(this.evaluationAnswers.urgency);
		
		const minAnswers = Math.min(3, this.questionConfig.importance.length, this.questionConfig.urgency.length);
		if (importanceAnswers.length < minAnswers || urgencyAnswers.length < minAnswers) {
			return;
		}
		
		// Score d'importance basé sur les réponses
		const importanceScore = importanceAnswers.filter(answer => answer === true).length / importanceAnswers.length;
		
		// Score d'urgence basé sur les réponses (inversé car les nouvelles questions portent sur la flexibilité)
		const questionUrgencyScore = 1 - (urgencyAnswers.filter(answer => answer === true).length / urgencyAnswers.length);
		
		// Score d'urgence temporelle basé sur les échéances
		const startDeadline = document.getElementById('startDeadline').value;
		const timeUrgencyScore = this.calculateTimeBasedUrgency(startDeadline);
		
		// Combinaison des deux scores d'urgence (60% temporel, 40% questionnaire)
		const finalUrgencyScore = (timeUrgencyScore * 0.6) + (questionUrgencyScore * 0.4);
		
		const isImportant = importanceScore >= 0.6;
		const isUrgent = finalUrgencyScore >= 0.6;
		
		let quadrant, description, quadrantClass;
		
		if (isUrgent && isImportant) {
			quadrant = '🚨 À TRAITER (Urgent + Important)';
			description = 'Cette tâche nécessite votre attention immédiate. Planifiez-la en priorité absolue.';
			quadrantClass = 'urgent-important';
		} else if (isImportant && !isUrgent) {
			quadrant = '📋 À PLANIFIER (Important, pas urgent)';
			description = 'Cette tâche est importante pour vos objectifs. Programmez du temps dédié pour la réaliser.';
			quadrantClass = 'important-not-urgent';
		} else if (isUrgent && !isImportant) {
			quadrant = '👥 À DÉLÉGUER (Urgent, pas important)';
			description = 'Cette tâche est pressante mais pas cruciale. Déléguez-la si possible ou traitez-la rapidement.';
			quadrantClass = 'urgent-not-important';
		} else {
			quadrant = '🗑️ À ABANDONNER (Ni urgent, ni important)';
			description = 'Cette tâche n\'est pas prioritaire. Considérez l\'éliminer ou la reporter indéfiniment.';
			quadrantClass = 'not-urgent-not-important';
		}
		
		// Afficher le résultat avec indicateur d'urgence
		const resultDiv = document.getElementById('evaluationResult');
		const urgencyLabel = this.getUrgencyLabel(finalUrgencyScore);
		
		resultDiv.querySelector('.result-quadrant').innerHTML = `${quadrant} <span class="urgency-indicator ${urgencyLabel.class}">Urgence: ${urgencyLabel.text}</span>`;
		resultDiv.querySelector('.result-description').textContent = description;
		resultDiv.classList.remove('hidden');
		
		this.currentEvaluation = {
			isImportant,
			isUrgent,
			quadrant: quadrantClass,
			importanceScore,
			urgencyScore: finalUrgencyScore,
			timeUrgencyScore,
			questionUrgencyScore
		};
	}

	calculateEditEvaluationResult() {
		const importanceAnswers = Object.values(this.editEvaluationAnswers.importance);
		const urgencyAnswers = Object.values(this.editEvaluationAnswers.urgency);
		
		const minAnswers = Math.min(3, this.questionConfig.importance.length, this.questionConfig.urgency.length);
		if (importanceAnswers.length < minAnswers || urgencyAnswers.length < minAnswers) {
			return;
		}
		
		// Score d'importance basé sur les réponses
		const importanceScore = importanceAnswers.filter(answer => answer === true).length / importanceAnswers.length;
		
		// Score d'urgence basé sur les réponses (inversé car les nouvelles questions portent sur la flexibilité)
		const questionUrgencyScore = 1 - (urgencyAnswers.filter(answer => answer === true).length / urgencyAnswers.length);
		
		// Score d'urgence temporelle basé sur les échéances
		const startDeadline = document.getElementById('editStartDeadline').value;
		const timeUrgencyScore = this.calculateTimeBasedUrgency(startDeadline);
		
		// Combinaison des deux scores d'urgence (60% temporel, 40% questionnaire)
		const finalUrgencyScore = (timeUrgencyScore * 0.6) + (questionUrgencyScore * 0.4);
		
		const isImportant = importanceScore >= 0.6;
		const isUrgent = finalUrgencyScore >= 0.6;
		
		let quadrant, description, quadrantClass;
		
		if (isUrgent && isImportant) {
			quadrant = '🚨 À TRAITER (Urgent + Important)';
			description = 'Cette tâche nécessite votre attention immédiate. Planifiez-la en priorité absolue.';
			quadrantClass = 'urgent-important';
		} else if (isImportant && !isUrgent) {
			quadrant = '📋 À PLANIFIER (Important, pas urgent)';
			description = 'Cette tâche est importante pour vos objectifs. Programmez du temps dédié pour la réaliser.';
			quadrantClass = 'important-not-urgent';
		} else if (isUrgent && !isImportant) {
			quadrant = '👥 À DÉLÉGUER (Urgent, pas important)';
			description = 'Cette tâche est pressante mais pas cruciale. Déléguez-la si possible ou traitez-la rapidement.';
			quadrantClass = 'urgent-not-important';
		} else {
			quadrant = '🗑️ À ABANDONNER (Ni urgent, ni important)';
			description = 'Cette tâche n\'est pas prioritaire. Considérez l\'éliminer ou la reporter indéfiniment.';
			quadrantClass = 'not-urgent-not-important';
		}
		
		// Afficher le résultat avec indicateur d'urgence
		const resultDiv = document.getElementById('editEvaluationResult');
		const urgencyLabel = this.getUrgencyLabel(finalUrgencyScore);
		
		resultDiv.querySelector('.result-quadrant').innerHTML = `${quadrant} <span class="urgency-indicator ${urgencyLabel.class}">Urgence: ${urgencyLabel.text}</span>`;
		resultDiv.querySelector('.result-description').textContent = description;
		resultDiv.classList.remove('hidden');
		
		this.editCurrentEvaluation = {
			isImportant,
			isUrgent,
			quadrant: quadrantClass,
			importanceScore,
			urgencyScore: finalUrgencyScore,
			timeUrgencyScore,
			questionUrgencyScore
		};
	}

	getQuadrantFromEvaluation(isImportant, isUrgent) {
		if (isUrgent && isImportant) {
			return 'urgent-important';
		} else if (isImportant && !isUrgent) {
			return 'important-not-urgent';
		} else if (isUrgent && !isImportant) {
			return 'urgent-not-important';
		} else {
			return 'not-urgent-not-important';
		}
	}

	setupDragAndDrop() {
		// Événements pour les colonnes (zones de dépôt)
		document.querySelectorAll('.kanban-column').forEach(column => {
			column.addEventListener('dragover', (e) => {
				e.preventDefault();
				column.classList.add('drag-over');
			});

			column.addEventListener('dragleave', (e) => {
				if (!column.contains(e.relatedTarget)) {
					column.classList.remove('drag-over');
				}
			});

			column.addEventListener('drop', (e) => {
				e.preventDefault();
				column.classList.remove('drag-over');
				
				if (this.draggedTask) {
					const newStatus = column.dataset.status;
					const taskId = this.draggedTask.dataset.taskId;
					
					if (taskId && newStatus) {
						this.updateTaskStatus(parseInt(taskId), newStatus);
					}
				}
				
				this.draggedTask = null;
			});
		});
	}

	showStatus(message, type = 'success') {
		const statusDiv = document.getElementById('statusMessage');
		statusDiv.innerHTML = `<div class="status-message status-${type}">${message}</div>`;
		
		setTimeout(() => {
			statusDiv.innerHTML = '';
		}, 5000);
	}

	async updateTaskStatus(id, newStatus) {
		try {
			const task = this.tasks.find(t => t.id === id);
			console.log('Mise à jour de la tâche:', {id, currentStatus: task?.status, newStatus});

			if (this.offlineMode) {
				if (task) {
					task.status = newStatus;
					task.completed = newStatus === 'done';
					this.renderTasks();
					
					const statusMessages = {
						'todo': 'Tâche remise à faire',
						'inprogress': 'Tâche mise en cours',
						'done': 'Tâche marquée comme terminée'
					};
					this.showStatus(statusMessages[newStatus] + ' (mode hors ligne)', 'warning');
				}
				return;
			}

			const updateData = {};
			
			if (newStatus === 'done') {
				updateData.completed = true;
				updateData.status = 'done';
			} else {
				updateData.completed = false;
				updateData.status = newStatus;
			}

			console.log('Données envoyées:', updateData);

			const response = await fetch(`${this.apiUrl}/${id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(updateData),
				signal: AbortSignal.timeout(10000)
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error('Erreur serveur:', errorText);
				throw new Error(`Erreur HTTP: ${response.status} - ${errorText}`);
			}

			const data = await response.json();
			console.log('Réponse serveur:', data);
			
			if (data.success) {
				const statusMessages = {
					'todo': 'Tâche remise à faire',
					'inprogress': 'Tâche mise en cours',
					'done': 'Tâche marquée comme terminée'
				};
				this.showStatus(statusMessages[newStatus], 'success');
				await this.loadTasks();
			} else {
				this.showStatus('Erreur lors de la mise à jour: ' + (data.error || 'Erreur inconnue'), 'error');
			}
		} catch (error) {
			console.error('Erreur lors de la mise à jour de la tâche:', error);
			
			let errorMessage = 'Erreur de connexion lors de la mise à jour';
			if (error.name === 'TimeoutError') {
				errorMessage = 'Délai d\'attente dépassé lors de la mise à jour';
			}
			
			this.showStatus(errorMessage + ': ' + error.message, 'error');
		}
	}

	async deleteTask(id) {
		if (!confirm('Êtes-vous sûr de vouloir supprimer cette tâche ?')) {
			return;
		}

		if (this.offlineMode) {
			this.tasks = this.tasks.filter(t => t.id !== id);
			this.renderTasks();
			this.showStatus('Tâche supprimée (mode hors ligne)', 'warning');
			return;
		}

		try {
			const response = await fetch(`${this.apiUrl}/${id}`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
				},
				signal: AbortSignal.timeout(10000)
			});

			if (!response.ok) {
				throw new Error(`Erreur HTTP: ${response.status}`);
			}

			const data = await response.json();
			
			if (data.success) {
				this.showStatus('Tâche supprimée avec succès', 'success');
				await this.loadTasks();
			} else {
				this.showStatus('Erreur lors de la suppression: ' + (data.error || 'Erreur inconnue'), 'error');
			}
		} catch (error) {
			console.error('Erreur lors de la suppression de la tâche:', error);
			
			let errorMessage = 'Erreur de connexion lors de la suppression';
			if (error.name === 'TimeoutError') {
				errorMessage = 'Délai d\'attente dépassé lors de la suppression';
			}
			
			this.showStatus(errorMessage, 'error');
		}
	}

	editTask(taskId) {
		const task = this.tasks.find(t => t.id === taskId);
		if (!task) {
			this.showStatus('Tâche introuvable', 'error');
			return;
		}

		this.editingTaskId = taskId;
		
		document.getElementById('editTaskId').value = taskId;
		document.getElementById('editTitle').value = task.title;
		document.getElementById('editDescription').value = task.description || '';
		document.getElementById('editDueDate').value = task.dueDate || '';
		document.getElementById('editEstimatedDuration').value = task.estimatedDuration || '';
		document.getElementById('editStartDeadline').value = task.startDeadline || '';
		
		if (task.eisenhowerEvaluation) {
			this.loadExistingEvaluation(task.eisenhowerEvaluation);
		} else {
			this.resetEditEvaluation();
		}
		
		document.getElementById('editTaskModal').classList.add('show');
		document.body.style.overflow = 'hidden';
	}

	loadExistingEvaluation(evaluation) {
		const isImportant = evaluation.isImportant;
		const isUrgent = evaluation.isUrgent;
		
		this.resetEditEvaluation();
		
		if (isImportant) {
			this.setEditAnswer('importance', '1', true);
			this.setEditAnswer('importance', '2', true);
			this.setEditAnswer('importance', '3', true);
		} else {
			this.setEditAnswer('importance', '1', false);
			this.setEditAnswer('importance', '2', false);
			this.setEditAnswer('importance', '3', false);
		}
		
		if (isUrgent) {
			this.setEditAnswer('urgency', '1', true);
			this.setEditAnswer('urgency', '2', true);
			this.setEditAnswer('urgency', '3', true);
		} else {
			this.setEditAnswer('urgency', '1', false);
			this.setEditAnswer('urgency', '2', false);
			this.setEditAnswer('urgency', '3', false);
		}
		
		this.calculateEditEvaluationResult();
	}

	setEditAnswer(questionType, questionId, isYes) {
		const item = document.querySelector(`#editTaskModal .question-item[data-question="${questionType}"][data-id="${questionId}"]`);
		if (item) {
			const buttons = item.querySelectorAll('.btn-yes, .btn-no');
			buttons.forEach(btn => btn.classList.remove('selected'));
			
			const targetButton = item.querySelector(isYes ? '.btn-yes' : '.btn-no');
			if (targetButton) {
				targetButton.classList.add('selected');
				this.editEvaluationAnswers[questionType][questionId] = isYes;
			}
		}
	}

	resetEditForm() {
		document.getElementById('editTaskForm').reset();
		this.resetEditEvaluation();
		this.editingTaskId = null;
	}

	resetEditEvaluation() {
		this.editEvaluationAnswers = {
			importance: {},
			urgency: {}
		};
		
		document.querySelectorAll('#editTaskModal .btn-yes, #editTaskModal .btn-no').forEach(btn => {
			btn.classList.remove('selected');
		});
		
		document.getElementById('editEvaluationResult').classList.add('hidden');
		this.editCurrentEvaluation = null;
	}

	async saveEditedTask() {
		const form = document.getElementById('editTaskForm');
		const saveBtn = document.getElementById('saveTaskBtn');
		const formData = new FormData(form);
		
		const taskData = {
			title: formData.get('title'),
			description: formData.get('description'),
			dueDate: formData.get('dueDate'),
			estimatedDuration: formData.get('estimatedDuration'),
			startDeadline: document.getElementById('editStartDeadline').value
		};

		if (this.editCurrentEvaluation) {
			taskData.eisenhowerEvaluation = this.editCurrentEvaluation;
		}

		saveBtn.disabled = true;
		saveBtn.textContent = '⏳ Sauvegarde...';

		// Mode hors ligne
		if (this.offlineMode) {
			const taskIndex = this.tasks.findIndex(t => t.id === this.editingTaskId);
			if (taskIndex !== -1) {
				this.tasks[taskIndex] = { ...this.tasks[taskIndex], ...taskData };
				this.renderTasks();
				
				document.getElementById('editTaskModal').classList.remove('show');
				document.body.style.overflow = 'auto';
				this.resetEditForm();
				
				this.showStatus('Tâche modifiée en mode hors ligne', 'warning');
			}
			
			saveBtn.disabled = false;
			saveBtn.textContent = '💾 Sauvegarder';
			return;
		}

		try {
			const response = await fetch(`${this.apiUrl}/${this.editingTaskId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(taskData),
				signal: AbortSignal.timeout(10000)
			});

			if (!response.ok) {
				throw new Error(`Erreur HTTP: ${response.status}`);
			}

			const data = await response.json();
			
			if (data.success) {
				document.getElementById('editTaskModal').classList.remove('show');
				document.body.style.overflow = 'auto';
				
				this.resetEditForm();
				this.showStatus('Tâche modifiée avec succès !', 'success');
				await this.loadTasks();
				
				setTimeout(() => {
					const editedTask = document.querySelector(`[data-task-id="${this.editingTaskId}"]`);
					if (editedTask) {
						editedTask.classList.add('moved');
						setTimeout(() => {
							editedTask.classList.remove('moved');
						}, 400);
					}
				}, 100);

			} else {
				this.showStatus('Erreur lors de la modification: ' + (data.error || 'Erreur inconnue'), 'error');
			}
		} catch (error) {
			console.error('Erreur lors de la modification de la tâche:', error);
			
			let errorMessage = 'Erreur de connexion lors de la modification';
			if (error.name === 'TimeoutError') {
				errorMessage = 'Délai d\'attente dépassé lors de la modification';
			}
			
			this.showStatus(errorMessage, 'error');
		} finally {
			saveBtn.disabled = false;
			saveBtn.textContent = '💾 Sauvegarder';
		}
	}

	renderTasks() {
		const todoContainer = document.getElementById('todoTasks');
		const inprogressContainer = document.getElementById('inprogressTasks');
		const doneContainer = document.getElementById('doneTasks');

		const todoTasks = this.tasks.filter(t => {
			if (t.status) return t.status === 'todo';
			return !t.completed;
		});
		
		const inprogressTasks = this.tasks.filter(t => {
			if (t.status) return t.status === 'inprogress';
			return false;
		});
		
		const doneTasks = this.tasks.filter(t => {
			if (t.status) return t.status === 'done';
			return t.completed;
		});

		console.log('Répartition des tâches:', {
			todo: todoTasks.length,
			inprogress: inprogressTasks.length,
			done: doneTasks.length,
			total: this.tasks.length
		});

		document.getElementById('todoCount').textContent = todoTasks.length;
		document.getElementById('inprogressCount').textContent = inprogressTasks.length;
		document.getElementById('doneCount').textContent = doneTasks.length;

		this.renderColumn(todoContainer, todoTasks, 'À faire');
		this.renderColumn(inprogressContainer, inprogressTasks, 'En cours');
		this.renderColumn(doneContainer, doneTasks, 'Terminées');
	}

	renderColumn(container, tasks, columnName) {
		if (tasks.length === 0) {
			container.innerHTML = `<div class="empty-column">Aucune tâche ${columnName.toLowerCase()}</div>`;
			return;
		}

		const sortedTasks = tasks.sort((a, b) => {
			const eisenhowerOrder = {
				'urgent-important': 4,
				'important-not-urgent': 3,
				'urgent-not-important': 2,
				'not-urgent-not-important': 1
			};
			
			const aQuadrant = a.eisenhowerEvaluation ? 
				this.getQuadrantFromEvaluation(a.eisenhowerEvaluation.isImportant, a.eisenhowerEvaluation.isUrgent) : 
				'not-urgent-not-important';
			const bQuadrant = b.eisenhowerEvaluation ? 
				this.getQuadrantFromEvaluation(b.eisenhowerEvaluation.isImportant, b.eisenhowerEvaluation.isUrgent) : 
				'not-urgent-not-important';
			
			if (eisenhowerOrder[aQuadrant] !== eisenhowerOrder[bQuadrant]) {
				return eisenhowerOrder[bQuadrant] - eisenhowerOrder[aQuadrant];
			}
			
			return new Date(b.createdAt) - new Date(a.createdAt);
		});

		container.innerHTML = sortedTasks.map(task => this.renderTaskCard(task)).join('');
		this.attachTaskEvents(container);
	}

	renderTaskCard(task) {
		const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString('fr-FR') : '';
		const createdDate = new Date(task.createdAt).toLocaleDateString('fr-FR');
		
		// ✅ Calculer TOUTES les valeurs avant le template HTML
		const startDeadline = task.startDeadline ? new Date(task.startDeadline).toLocaleDateString('fr-FR') : '';
		const timeUrgency = task.startDeadline ? this.calculateTimeBasedUrgency(task.startDeadline) : 0;
		const urgencyLabel = this.getUrgencyLabel(timeUrgency);
		
		let currentStatus = task.status;
		if (!currentStatus) {
			currentStatus = task.completed ? 'done' : 'todo';
		}

		let quadrantClass = 'not-urgent-not-important';
		let badgeText = '🗑️ À ABANDONNER';
		let badgeClass = 'badge-not-urgent-not-important';

		if (task.eisenhowerEvaluation) {
			quadrantClass = this.getQuadrantFromEvaluation(
				task.eisenhowerEvaluation.isImportant, 
				task.eisenhowerEvaluation.isUrgent
			);
			
			switch (quadrantClass) {
				case 'urgent-important':
					badgeText = '🚨 À TRAITER';
					badgeClass = 'badge-urgent-important';
					break;
				case 'important-not-urgent':
					badgeText = '📋 À PLANIFIER';
					badgeClass = 'badge-important-not-urgent';
					break;
				case 'urgent-not-important':
					badgeText = '👥 À DÉLÉGUER';
					badgeClass = 'badge-urgent-not-important';
					break;
				case 'not-urgent-not-important':
					badgeText = '🗑️ À ABANDONNER';
					badgeClass = 'badge-not-urgent-not-important';
					break;
			}
		}

		let actionButtons = '';
		switch (currentStatus) {
			case 'todo':
				actionButtons = `
					<button class="btn-small btn-start" onclick="taskManager.updateTaskStatus(${task.id}, 'inprogress')">
						▶️ Commencer
					</button>
					<button class="btn-small btn-complete" onclick="taskManager.updateTaskStatus(${task.id}, 'done')">
						✅ Terminer
					</button>
				`;
				break;
			case 'inprogress':
				actionButtons = `
					<button class="btn-small btn-restart" onclick="taskManager.updateTaskStatus(${task.id}, 'todo')">
						⏪ À faire
					</button>
					<button class="btn-small btn-complete" onclick="taskManager.updateTaskStatus(${task.id}, 'done')">
						✅ Terminer
					</button>
				`;
				break;
			case 'done':
				actionButtons = `
					<button class="btn-small btn-restart" onclick="taskManager.updateTaskStatus(${task.id}, 'todo')">
						↩️ Reprendre
					</button>
				`;
				break;
		}

		// ✅ Template HTML avec toutes les variables déjà calculées
		return `
			<div class="task-card quadrant-${quadrantClass}" 
				 data-task-id="${task.id}" 
				 draggable="true">
				<div class="task-eisenhower-badge ${badgeClass}">
					${badgeText}
				</div>
				<div class="task-title">${this.escapeHtml(task.title)}</div>
				${task.description ? `<div class="task-description">${this.escapeHtml(task.description)}</div>` : ''}
				
				<div class="task-meta">
					<div class="task-date">
						${dueDate ? `📅 Échéance: ${dueDate}` : `Créée le ${createdDate}`}
						${startDeadline ? `<br>⏰ Commencer avant: ${startDeadline}` : ''}
						${task.estimatedDuration ? `<br>⏱️ Durée: ${task.estimatedDuration}h` : ''}
					</div>
					${timeUrgency > 0 ? `<span class="urgency-indicator ${urgencyLabel.class}">${urgencyLabel.text}</span>` : ''}
				</div>
				
				<div class="task-actions">
					${actionButtons}
					<button class="btn-small btn-edit" onclick="taskManager.editTask(${task.id})">
						✏️
					</button>
					<button class="btn-small btn-delete" onclick="taskManager.deleteTask(${task.id})">
						🗑️
					</button>
				</div>
			</div>
		`;
	}

	attachTaskEvents(container) {
		container.querySelectorAll('.task-card').forEach(card => {
			card.addEventListener('dragstart', (e) => {
				this.draggedTask = card;
				card.classList.add('dragging');
				e.dataTransfer.effectAllowed = 'move';
			});

			card.addEventListener('dragend', (e) => {
				card.classList.remove('dragging');
				document.querySelectorAll('.kanban-column').forEach(col => {
					col.classList.remove('drag-over');
				});
			});
		});
	}

	escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}
}

// Variable globale pour pouvoir accéder aux méthodes depuis les onclick
let taskManager;

// Initialiser l'application
document.addEventListener('DOMContentLoaded', () => {
	taskManager = new TaskManager();
});
