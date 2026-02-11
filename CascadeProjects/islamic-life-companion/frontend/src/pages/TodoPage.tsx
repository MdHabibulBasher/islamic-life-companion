import { useState } from 'react'
import { Plus, Trash2, Check, Circle } from 'lucide-react'

interface Todo {
  id: string
  title: string
  description?: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  dueDate?: string
}

export const TodoPage = () => {
  const [todos, setTodos] = useState<Todo[]>([
    {
      id: '1',
      title: 'Complete daily Quran reading',
      description: 'Read 1 page from Quran',
      completed: false,
      priority: 'high',
      dueDate: '2026-02-11',
    },
    {
      id: '2',
      title: 'Complete 5 daily prayers',
      completed: true,
      priority: 'high',
      dueDate: '2026-02-11',
    },
    {
      id: '3',
      title: 'Review Quranic teachings',
      description: 'Study Surah Al-Baqarah',
      completed: false,
      priority: 'medium',
      dueDate: '2026-02-12',
    },
  ])

  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')

  const handleAddTodo = () => {
    if (newTitle.trim()) {
      const newTodo: Todo = {
        id: Date.now().toString(),
        title: newTitle,
        description: newDescription || undefined,
        completed: false,
        priority: 'medium',
        dueDate: new Date().toISOString().split('T')[0],
      }
      setTodos([newTodo, ...todos])
      setNewTitle('')
      setNewDescription('')
    }
  }

  const toggleTodo = (id: string) => {
    setTodos(todos.map((todo) => (todo.id === id ? { ...todo, completed: !todo.completed } : todo)))
  }

  const deleteTodo = (id: string) => {
    setTodos(todos.filter((todo) => todo.id !== id))
  }

  const filteredTodos = todos.filter((todo) => {
    if (filter === 'active') return !todo.completed
    if (filter === 'completed') return todo.completed
    return true
  })

  const completedCount = todos.filter((t) => t.completed).length
  const progress = todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 dark:bg-red-900/20 border-red-600'
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-600'
      case 'low':
        return 'bg-blue-100 dark:bg-blue-900/20 border-blue-600'
      default:
        return 'bg-gray-100 dark:bg-gray-800 border-gray-400'
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:pt-0">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">To-Do List</h1>

      {/* Progress Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Progress</h2>
          <span className="text-2xl font-bold text-green-600">
            {completedCount}/{todos.length}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div
            className="bg-green-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{progress}% Complete</p>
      </div>

      {/* Add Todo Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create New Task</h2>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Task title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddTodo()}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600"
          />
          <textarea
            placeholder="Task description (optional)..."
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            rows={2}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600"
          />
          <button
            onClick={handleAddTodo}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-medium"
          >
            <Plus size={20} />
            Add Task
          </button>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all'
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          All ({todos.length})
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'active'
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Active ({todos.filter((t) => !t.completed).length})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'completed'
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Completed ({todos.filter((t) => t.completed).length})
        </button>
      </div>

      {/* Todo List */}
      <div className="space-y-3">
        {filteredTodos.length > 0 ? (
          filteredTodos.map((todo) => (
            <div
              key={todo.id}
              className={`flex items-start gap-4 p-4 rounded-lg border-l-4 transition-all ${getPriorityColor(todo.priority)} ${
                todo.completed ? 'opacity-60' : ''
              }`}
            >
              <button
                onClick={() => toggleTodo(todo.id)}
                className="mt-1 flex-shrink-0 transition-colors"
              >
                {todo.completed ? (
                  <Check
                    size={24}
                    className="text-green-600 dark:text-green-400"
                  />
                ) : (
                  <Circle size={24} className="text-gray-400 dark:text-gray-600" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <h3
                  className={`font-semibold text-gray-900 dark:text-white ${
                    todo.completed ? 'line-through text-gray-600 dark:text-gray-400' : ''
                  }`}
                >
                  {todo.title}
                </h3>
                {todo.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{todo.description}</p>
                )}
                {todo.dueDate && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    Due: {new Date(todo.dueDate).toLocaleDateString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => deleteTodo(todo.id)}
                className="mt-1 flex-shrink-0 p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
              >
                <Trash2 size={18} className="text-red-600 dark:text-red-400" />
              </button>
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              {filter === 'completed' ? 'No completed tasks yet' : 'No tasks yet. Create one to get started!'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
