# app.py - Backend Flask pour le gestionnaire de tâches avec évaluation Eisenhower
from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
from datetime import datetime
import os
import json

app = Flask(__name__)
CORS(app)  # Permet les requêtes cross-origin depuis le frontend

# Configuration de la base de données
DATABASE = 'tasks.db'

def init_db():
    """Initialise la base de données avec la table des tâches"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Créer la table avec toutes les colonnes nécessaires
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            priority TEXT DEFAULT 'moyenne',
            due_date TEXT,
            completed INTEGER DEFAULT 0,
            status TEXT DEFAULT 'todo',
            created_at TEXT NOT NULL,
            eisenhower_evaluation TEXT,
            estimated_duration REAL,
            start_deadline TEXT
        )
    ''')
    
    conn.commit()
    conn.close()

def migrate_db():
    """Ajoute les nouveaux champs à la base existante si ils n'existent pas"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    try:
        # Vérifier quelles colonnes existent déjà
        cursor.execute("PRAGMA table_info(tasks)")
        columns = [column[1] for column in cursor.fetchall()]
        
        # Ajouter la colonne status si elle n'existe pas
        if 'status' not in columns:
            cursor.execute('ALTER TABLE tasks ADD COLUMN status TEXT DEFAULT "todo"')
            cursor.execute('UPDATE tasks SET status = "done" WHERE completed = 1')
            cursor.execute('UPDATE tasks SET status = "todo" WHERE completed = 0')
            print("✅ Migration réussie : colonne 'status' ajoutée")
        
        # Ajouter la colonne eisenhower_evaluation si elle n'existe pas
        if 'eisenhower_evaluation' not in columns:
            cursor.execute('ALTER TABLE tasks ADD COLUMN eisenhower_evaluation TEXT')
            print("✅ Migration réussie : colonne 'eisenhower_evaluation' ajoutée")
        
        # Ajouter la colonne estimated_duration si elle n'existe pas
        if 'estimated_duration' not in columns:
            cursor.execute('ALTER TABLE tasks ADD COLUMN estimated_duration REAL')
            print("✅ Migration réussie : colonne 'estimated_duration' ajoutée")
        
        # Ajouter la colonne start_deadline si elle n'existe pas
        if 'start_deadline' not in columns:
            cursor.execute('ALTER TABLE tasks ADD COLUMN start_deadline TEXT')
            print("✅ Migration réussie : colonne 'start_deadline' ajoutée")
        
        print("✅ Base de données à jour")
    
    except Exception as e:
        print(f"❌ Erreur lors de la migration : {e}")
    
    conn.commit()
    conn.close()

def get_db_connection():
    """Retourne une connexion à la base de données"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row  # Permet d'accéder aux colonnes par nom
    return conn

@app.route('/')
def index():
    """Sert la page d'accueil"""
    return "API du Gestionnaire de Tâches avec Évaluation Eisenhower - Utilisez /api/tasks pour interagir avec l'API"

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    """Récupère toutes les tâches"""
    try:
        conn = get_db_connection()
        tasks = conn.execute('''
            SELECT id, title, description, priority, due_date, completed, status, created_at, 
                   eisenhower_evaluation, estimated_duration, start_deadline
            FROM tasks 
            ORDER BY 
                CASE priority 
                    WHEN 'haute' THEN 3 
                    WHEN 'moyenne' THEN 2 
                    WHEN 'basse' THEN 1 
                END DESC, 
                created_at DESC
        ''').fetchall()
        conn.close()
        
        # Convertir les résultats en dictionnaires
        tasks_list = []
        for task in tasks:
            task_dict = {
                'id': task['id'],
                'title': task['title'],
                'description': task['description'],
                'priority': task['priority'],
                'dueDate': task['due_date'],
                'completed': bool(task['completed']),
                'status': task['status'] or ('done' if task['completed'] else 'todo'),
                'createdAt': task['created_at'],
                'estimatedDuration': task['estimated_duration'],
                'startDeadline': task['start_deadline']
            }
            
            # Ajouter l'évaluation Eisenhower si elle existe
            if task['eisenhower_evaluation']:
                try:
                    task_dict['eisenhowerEvaluation'] = json.loads(task['eisenhower_evaluation'])
                except json.JSONDecodeError:
                    pass  # Ignorer si le JSON est invalide
            
            tasks_list.append(task_dict)
        
        return jsonify({'success': True, 'tasks': tasks_list})
    
    except Exception as e:
        print(f"Erreur lors du chargement des tâches: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tasks', methods=['POST'])
def create_task():
    """Crée une nouvelle tâche"""
    try:
        data = request.get_json()
        
        # Validation des données
        if not data or not data.get('title'):
            return jsonify({'success': False, 'error': 'Le titre est requis'}), 400
        
        title = data['title']
        description = data.get('description', '')
        priority = data.get('priority', 'moyenne')
        due_date = data.get('dueDate')
        estimated_duration = data.get('estimatedDuration')
        start_deadline = data.get('startDeadline')
        created_at = datetime.now().isoformat()
        
        # Validation de la priorité
        if priority not in ['basse', 'moyenne', 'haute']:
            priority = 'moyenne'
        
        # Gérer l'évaluation Eisenhower
        eisenhower_evaluation = None
        if 'eisenhowerEvaluation' in data:
            try:
                eisenhower_evaluation = json.dumps(data['eisenhowerEvaluation'])
            except Exception as e:
                print(f"Erreur lors de la sérialisation de l'évaluation Eisenhower: {e}")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO tasks (title, description, priority, due_date, completed, status, created_at, 
                             eisenhower_evaluation, estimated_duration, start_deadline)
            VALUES (?, ?, ?, ?, 0, 'todo', ?, ?, ?, ?)
        ''', (title, description, priority, due_date, created_at, eisenhower_evaluation, 
              estimated_duration, start_deadline))
        
        task_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        # Retourner la tâche créée
        new_task = {
            'id': task_id,
            'title': title,
            'description': description,
            'priority': priority,
            'dueDate': due_date,
            'completed': False,
            'status': 'todo',
            'createdAt': created_at,
            'estimatedDuration': estimated_duration,
            'startDeadline': start_deadline
        }
        
        # Ajouter l'évaluation si elle existe
        if eisenhower_evaluation:
            try:
                new_task['eisenhowerEvaluation'] = json.loads(eisenhower_evaluation)
            except json.JSONDecodeError:
                pass
        
        return jsonify({'success': True, 'task': new_task}), 201
    
    except Exception as e:
        print(f"Erreur lors de la création de la tâche: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    """Met à jour une tâche existante"""
    try:
        data = request.get_json()
        print(f"Mise à jour tâche {task_id} avec données: {data}")
        
        conn = get_db_connection()
        
        # Vérifier que la tâche existe
        task = conn.execute('SELECT * FROM tasks WHERE id = ?', (task_id,)).fetchone()
        if not task:
            conn.close()
            return jsonify({'success': False, 'error': 'Tâche non trouvée'}), 404
        
        # Construire la requête de mise à jour dynamiquement
        updates = []
        params = []
        
        if 'title' in data:
            updates.append('title = ?')
            params.append(data['title'])
        
        if 'description' in data:
            updates.append('description = ?')
            params.append(data['description'])
        
        if 'priority' in data and data['priority'] in ['basse', 'moyenne', 'haute']:
            updates.append('priority = ?')
            params.append(data['priority'])
        
        if 'dueDate' in data:
            updates.append('due_date = ?')
            params.append(data['dueDate'])
        
        if 'estimatedDuration' in data:
            updates.append('estimated_duration = ?')
            params.append(data['estimatedDuration'])
        
        if 'startDeadline' in data:
            updates.append('start_deadline = ?')
            params.append(data['startDeadline'])
        
        if 'completed' in data:
            updates.append('completed = ?')
            params.append(bool(data['completed']))
        
        # Gestion du statut - IMPORTANT pour le drag & drop
        if 'status' in data and data['status'] in ['todo', 'inprogress', 'done']:
            updates.append('status = ?')
            params.append(data['status'])
            
            # Synchroniser completed avec status pour compatibilité
            if data['status'] == 'done':
                updates.append('completed = ?')
                params.append(True)
            else:
                updates.append('completed = ?')
                params.append(False)
        
        # Gestion de l'évaluation Eisenhower
        if 'eisenhowerEvaluation' in data:
            try:
                eisenhower_json = json.dumps(data['eisenhowerEvaluation']) if data['eisenhowerEvaluation'] else None
                updates.append('eisenhower_evaluation = ?')
                params.append(eisenhower_json)
            except Exception as e:
                print(f"Erreur lors de la mise à jour de l'évaluation Eisenhower: {e}")
        
        if not updates:
            conn.close()
            return jsonify({'success': False, 'error': 'Aucune donnée à mettre à jour'}), 400
        
        params.append(task_id)
        query = f"UPDATE tasks SET {', '.join(updates)} WHERE id = ?"
        
        print(f"Requête SQL: {query}")
        print(f"Paramètres: {params}")
        
        conn.execute(query, params)
        conn.commit()
        
        # Récupérer la tâche mise à jour
        updated_task = conn.execute('SELECT * FROM tasks WHERE id = ?', (task_id,)).fetchone()
        conn.close()
        
        task_dict = {
            'id': updated_task['id'],
            'title': updated_task['title'],
            'description': updated_task['description'],
            'priority': updated_task['priority'],
            'dueDate': updated_task['due_date'],
            'completed': bool(updated_task['completed']),
            'status': updated_task['status'],
            'createdAt': updated_task['created_at'],
            'estimatedDuration': updated_task['estimated_duration'],
            'startDeadline': updated_task['start_deadline']
        }
        
        # Ajouter l'évaluation Eisenhower si elle existe
        if updated_task['eisenhower_evaluation']:
            try:
                task_dict['eisenhowerEvaluation'] = json.loads(updated_task['eisenhower_evaluation'])
            except json.JSONDecodeError:
                pass
        
        print(f"Tâche mise à jour: {task_dict}")
        return jsonify({'success': True, 'task': task_dict})
    
    except Exception as e:
        print(f"Erreur lors de la mise à jour de la tâche: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    """Supprime une tâche"""
    try:
        conn = get_db_connection()
        
        # Vérifier que la tâche existe
        task = conn.execute('SELECT * FROM tasks WHERE id = ?', (task_id,)).fetchone()
        if not task:
            conn.close()
            return jsonify({'success': False, 'error': 'Tâche non trouvée'}), 404
        
        conn.execute('DELETE FROM tasks WHERE id = ?', (task_id,))
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Tâche supprimée avec succès'})
    
    except Exception as e:
        print(f"Erreur lors de la suppression de la tâche: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tasks/<int:task_id>/toggle', methods=['POST'])
def toggle_task(task_id):
    """Bascule le statut de completion d'une tâche"""
    try:
        conn = get_db_connection()
        
        # Récupérer l'état actuel
        task = conn.execute('SELECT completed, status FROM tasks WHERE id = ?', (task_id,)).fetchone()
        if not task:
            conn.close()
            return jsonify({'success': False, 'error': 'Tâche non trouvée'}), 404
        
        new_completed = not bool(task['completed'])
        new_status = 'done' if new_completed else 'todo'
        
        conn.execute('UPDATE tasks SET completed = ?, status = ? WHERE id = ?', 
                    (new_completed, new_status, task_id))
        conn.commit()
        
        # Récupérer la tâche mise à jour
        updated_task = conn.execute('SELECT * FROM tasks WHERE id = ?', (task_id,)).fetchone()
        conn.close()
        
        task_dict = {
            'id': updated_task['id'],
            'title': updated_task['title'],
            'description': updated_task['description'],
            'priority': updated_task['priority'],
            'dueDate': updated_task['due_date'],
            'completed': bool(updated_task['completed']),
            'status': updated_task['status'],
            'createdAt': updated_task['created_at'],
            'estimatedDuration': updated_task['estimated_duration'],
            'startDeadline': updated_task['start_deadline']
        }
        
        # Ajouter l'évaluation Eisenhower si elle existe
        if updated_task['eisenhower_evaluation']:
            try:
                task_dict['eisenhowerEvaluation'] = json.loads(updated_task['eisenhower_evaluation'])
            except json.JSONDecodeError:
                pass
        
        return jsonify({'success': True, 'task': task_dict})
    
    except Exception as e:
        print(f"Erreur lors du toggle de la tâche: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tasks/stats', methods=['GET'])
def get_task_stats():
    """Retourne des statistiques sur les tâches"""
    try:
        conn = get_db_connection()
        
        # Statistiques générales
        total_tasks = conn.execute('SELECT COUNT(*) as count FROM tasks').fetchone()['count']
        completed_tasks = conn.execute('SELECT COUNT(*) as count FROM tasks WHERE completed = 1').fetchone()['count']
        
        # Statistiques par priorité
        priority_stats = {}
        for priority in ['haute', 'moyenne', 'basse']:
            count = conn.execute('SELECT COUNT(*) as count FROM tasks WHERE priority = ?', (priority,)).fetchone()['count']
            priority_stats[priority] = count
        
        # Statistiques par statut
        status_stats = {}
        for status in ['todo', 'inprogress', 'done']:
            count = conn.execute('SELECT COUNT(*) as count FROM tasks WHERE status = ?', (status,)).fetchone()['count']
            status_stats[status] = count
        
        # Statistiques Eisenhower (tâches avec évaluation manuelle)
        eisenhower_stats = {
            'evaluated_tasks': 0,
            'quadrants': {
                'urgent_important': 0,
                'important_not_urgent': 0,
                'urgent_not_important': 0,
                'not_urgent_not_important': 0
            }
        }
        
        tasks_with_evaluation = conn.execute('SELECT eisenhower_evaluation FROM tasks WHERE eisenhower_evaluation IS NOT NULL').fetchall()
        eisenhower_stats['evaluated_tasks'] = len(tasks_with_evaluation)
        
        for task in tasks_with_evaluation:
            try:
                evaluation = json.loads(task['eisenhower_evaluation'])
                is_urgent = evaluation.get('isUrgent', False)
                is_important = evaluation.get('isImportant', False)
                
                if is_urgent and is_important:
                    eisenhower_stats['quadrants']['urgent_important'] += 1
                elif is_important and not is_urgent:
                    eisenhower_stats['quadrants']['important_not_urgent'] += 1
                elif is_urgent and not is_important:
                    eisenhower_stats['quadrants']['urgent_not_important'] += 1
                else:
                    eisenhower_stats['quadrants']['not_urgent_not_important'] += 1
            except json.JSONDecodeError:
                continue
        
        conn.close()
        
        stats = {
            'total_tasks': total_tasks,
            'completed_tasks': completed_tasks,
            'completion_rate': round((completed_tasks / total_tasks * 100) if total_tasks > 0 else 0, 1),
            'priority_stats': priority_stats,
            'status_stats': status_stats,
            'eisenhower_stats': eisenhower_stats
        }
        
        return jsonify({'success': True, 'stats': stats})
    
    except Exception as e:
        print(f"Erreur lors du calcul des statistiques: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

import os

import os
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Important pour les requêtes cross-origin

if __name__ == '__main__':
    # Initialiser et migrer la base de données au démarrage
    print("🚀 Démarrage du serveur...")
    init_db()
    migrate_db()
    print("✅ Base de données prête")
    # Récupérer le port depuis Render ou utiliser 5000 par défaut pour tests locaux
    port = int(os.environ.get('PORT', 5000))
    print(f"🌐 Serveur disponible sur http://0.0.0.0:{port}")
    print(f"📊 API de statistiques: http://0.0.0.0:{port}/api/tasks/stats")
    # Lancer l'application avec host 0.0.0.0 et port dynamique
    app.run(debug=False, host='0.0.0.0', port=port)
