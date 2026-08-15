/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/control-has-associated-label */

import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  createTodo,
  deleteTodo,
  getTodos,
  updateTodo,
  USER_ID,
} from './api/todos';

import { Todo } from './types/Todo';
import { UserWarning } from './UserWarning';

type Filter = 'All' | 'Active' | 'Completed';

export const App: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [filter, setFilter] = useState<Filter>('All');

  const [title, setTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [tempTodo, setTempTodo] = useState<Todo | null>(null);

  const [loadingIds, setLoadingIds] = useState<Set<number>>(
    new Set(),
  );

  const [editingTodoId, setEditingTodoId] = useState<
    number | null
  >(null);

  const [editTitle, setEditTitle] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const errorTimerRef = useRef<number | null>(null);

  const isSavingEditRef = useRef(false);

  const hideError = () => {
    if (errorTimerRef.current !== null) {
      window.clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }

    setErrorMessage('');
  };

  const showError = (message: string) => {
    if (errorTimerRef.current !== null) {
      window.clearTimeout(errorTimerRef.current);
    }

    setErrorMessage(message);

    errorTimerRef.current = window.setTimeout(() => {
      setErrorMessage('');
      errorTimerRef.current = null;
    }, 3000);
  };

  const startLoading = (todoId: number) => {
    setLoadingIds(currentIds => {
      const newIds = new Set(currentIds);

      newIds.add(todoId);

      return newIds;
    });
  };

  const stopLoading = (todoId: number) => {
    setLoadingIds(currentIds => {
      const newIds = new Set(currentIds);

      newIds.delete(todoId);

      return newIds;
    });
  };

  const updateTodoInState = (
    todoId: number,
    changes: Partial<Todo>,
  ) => {
    setTodos(currentTodos =>
      currentTodos.map(todo =>
        todo.id === todoId
          ? {
              ...todo,
              ...changes,
            }
          : todo,
      ),
    );
  };

  useEffect(() => {
    if (!USER_ID) {
      return;
    }

    getTodos()
      .then(loadedTodos => {
        setTodos(loadedTodos);
      })
      .catch(() => {
        showError('Unable to load todos');
      });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isAdding) {
      inputRef.current?.focus();
    }
  }, [isAdding]);

  useEffect(() => {
    if (editingTodoId !== null) {
      editInputRef.current?.focus();
    }
  }, [editingTodoId]);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current !== null) {
        window.clearTimeout(errorTimerRef.current);
      }
    };
  }, []);

  const handleSubmit = (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    hideError();

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      showError('Title should not be empty');
      inputRef.current?.focus();

      return;
    }

    setIsAdding(true);

    setTempTodo({
      id: 0,
      userId: USER_ID,
      title: trimmedTitle,
      completed: false,
    });

    createTodo(trimmedTitle)
      .then(createdTodo => {
        setTodos(currentTodos => [
          ...currentTodos,
          createdTodo,
        ]);

        setTitle('');
      })
      .catch(() => {
        showError('Unable to add a todo');
      })
      .finally(() => {
        setIsAdding(false);
        setTempTodo(null);
      });
  };

  const handleDelete = (todoId: number) => {
    hideError();

    startLoading(todoId);

    deleteTodo(todoId)
      .then(() => {
        setTodos(currentTodos =>
          currentTodos.filter(todo => todo.id !== todoId),
        );
      })
      .catch(() => {
        showError('Unable to delete a todo');
      })
      .finally(() => {
        stopLoading(todoId);
        inputRef.current?.focus();
      });
  };

  const handleToggle = (todo: Todo) => {
    hideError();

    startLoading(todo.id);

    updateTodo(todo.id, {
      completed: !todo.completed,
    })
      .then(updatedTodo => {
        updateTodoInState(todo.id, updatedTodo);
      })
      .catch(() => {
        showError('Unable to update a todo');
      })
      .finally(() => {
        stopLoading(todo.id);
      });
  };

  const allCompleted =
    todos.length > 0 &&
    todos.every(todo => todo.completed);

  const handleToggleAll = () => {
    hideError();

    const newCompletedStatus = !allCompleted;

    const todosToUpdate = todos.filter(
      todo => todo.completed !== newCompletedStatus,
    );

    todosToUpdate.forEach(todo => {
      startLoading(todo.id);
    });

    const requests = todosToUpdate.map(todo =>
      updateTodo(todo.id, {
        completed: newCompletedStatus,
      }),
    );

    Promise.allSettled(requests)
      .then(results => {
        results.forEach((result, index) => {
          const todo = todosToUpdate[index];

          if (result.status === 'fulfilled') {
            updateTodoInState(todo.id, result.value);
          }
        });

        const hasError = results.some(
          result => result.status === 'rejected',
        );

        if (hasError) {
          showError('Unable to update a todo');
        }
      })
      .finally(() => {
        todosToUpdate.forEach(todo => {
          stopLoading(todo.id);
        });
      });
  };

  const handleEditStart = (todo: Todo) => {
    if (loadingIds.has(todo.id)) {
      return;
    }

    setEditingTodoId(todo.id);
    setEditTitle(todo.title);
    isSavingEditRef.current = false;
  };

  const cancelEditing = () => {
    isSavingEditRef.current = false;
    setEditingTodoId(null);
    setEditTitle('');
  };

  const handleEditSubmit = (
    event?: React.FormEvent<HTMLFormElement>,
  ) => {
    event?.preventDefault();

    if (editingTodoId === null) {
      return;
    }

    if (isSavingEditRef.current) {
      return;
    }

    const todo = todos.find(
      currentTodo => currentTodo.id === editingTodoId,
    );

    if (!todo) {
      cancelEditing();

      return;
    }

    const trimmedTitle = editTitle.trim();

    if (trimmedTitle === todo.title) {
      cancelEditing();

      return;
    }

    if (!trimmedTitle) {
      isSavingEditRef.current = true;

      setEditingTodoId(null);
      setEditTitle('');

      handleDelete(todo.id);

      return;
    }

    isSavingEditRef.current = true;

    startLoading(todo.id);

    updateTodo(todo.id, {
      title: trimmedTitle,
    })
      .then(updatedTodo => {
        updateTodoInState(todo.id, updatedTodo);

        setEditingTodoId(null);
        setEditTitle('');
      })
      .catch(() => {
        showError('Unable to update a todo');
      })
      .finally(() => {
        isSavingEditRef.current = false;
        stopLoading(todo.id);
      });
  };

  const handleEditKeyUp = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === 'Escape') {
      cancelEditing();
    }
  };

  const clearCompleted = () => {
    hideError();

    const completedTodos = todos.filter(
      todo => todo.completed,
    );

    completedTodos.forEach(todo => {
      startLoading(todo.id);
    });

    const requests = completedTodos.map(todo =>
      deleteTodo(todo.id),
    );

    Promise.allSettled(requests)
      .then(results => {
        const successfullyDeletedIds = completedTodos
          .filter((_, index) => {
            return results[index].status === 'fulfilled';
          })
          .map(todo => todo.id);

        setTodos(currentTodos =>
          currentTodos.filter(
            todo => !successfullyDeletedIds.includes(todo.id),
          ),
        );

        const hasError = results.some(
          result => result.status === 'rejected',
        );

        if (hasError) {
          showError('Unable to delete a todo');
        }
      })
      .finally(() => {
        completedTodos.forEach(todo => {
          stopLoading(todo.id);
        });
      });
  };

  let visibleTodos = todos;

  switch (filter) {
    case 'Active':
      visibleTodos = todos.filter(todo => !todo.completed);
      break;

    case 'Completed':
      visibleTodos = todos.filter(todo => todo.completed);
      break;

    case 'All':
    default:
      visibleTodos = todos;
  }

  const activeTodosCount = todos.filter(
    todo => !todo.completed,
  ).length;

  const hasCompletedTodos = todos.some(
    todo => todo.completed,
  );

  if (!USER_ID) {
    return <UserWarning />;
  }

  return (
    <div className="todoapp">
      <h1 className="todoapp__title">todos</h1>

      <div className="todoapp__content">
        <header className="todoapp__header">
          <button
            type="button"
            className={`todoapp__toggle-all ${
              allCompleted ? 'active' : ''
            }`}
            data-cy="ToggleAllButton"
            onClick={handleToggleAll}
          />

          <form onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              data-cy="NewTodoField"
              type="text"
              className="todoapp__new-todo"
              placeholder="What needs to be done?"
              value={title}
              disabled={isAdding}
              onChange={event => setTitle(event.target.value)}
            />
          </form>
        </header>

        {(todos.length > 0 || tempTodo !== null) && (
          <section
            className="todoapp__main"
            data-cy="TodoList"
          >
            {visibleTodos.map(todo => {
              const isLoading = loadingIds.has(todo.id);
              const isEditing = editingTodoId === todo.id;

              return (
                <div
                  key={todo.id}
                  data-cy="Todo"
                  className={`todo ${
                    todo.completed ? 'completed' : ''
                  }`}
                >
                  <label className="todo__status-label">
                    <input
                      data-cy="TodoStatus"
                      type="checkbox"
                      className="todo__status"
                      checked={todo.completed}
                      disabled={isLoading || isEditing}
                      onChange={() => handleToggle(todo)}
                    />
                  </label>

                  {isEditing ? (
                    <form
                      onSubmit={handleEditSubmit}
                      className="todo__edit"
                    >
                      <input
                        ref={editInputRef}
                        data-cy="TodoEditInput"
                        type="text"
                        className="todo__title-field"
                        value={editTitle}
                        onChange={event =>
                          setEditTitle(event.target.value)
                        }
                        onBlur={() => handleEditSubmit()}
                        onKeyUp={handleEditKeyUp}
                      />
                    </form>
                  ) : (
                    <>
                      <span
                        data-cy="TodoTitle"
                        className="todo__title"
                        onDoubleClick={() =>
                          handleEditStart(todo)
                        }
                      >
                        {todo.title}
                      </span>

                      <button
                        type="button"
                        className="todo__remove"
                        data-cy="TodoDelete"
                        disabled={isLoading}
                        onClick={() => handleDelete(todo.id)}
                      >
                        ×
                      </button>
                    </>
                  )}

                  <div
                    data-cy="TodoLoader"
                    className={`modal overlay ${
                      isLoading ? 'is-active' : ''
                    }`}
                  >
                    <div className="modal-background has-background-white-ter" />
                    <div className="loader" />
                  </div>
                </div>
              );
            })}

            {tempTodo !== null && (
              <div data-cy="Todo" className="todo">
                <label className="todo__status-label">
                  <input
                    data-cy="TodoStatus"
                    type="checkbox"
                    className="todo__status"
                    checked={false}
                    readOnly
                  />
                </label>

                <span
                  data-cy="TodoTitle"
                  className="todo__title"
                >
                  {tempTodo.title}
                </span>

                <div
                  data-cy="TodoLoader"
                  className="modal overlay is-active"
                >
                  <div className="modal-background has-background-white-ter" />
                  <div className="loader" />
                </div>
              </div>
            )}
          </section>
        )}

        {todos.length > 0 && (
          <footer
            className="todoapp__footer"
            data-cy="Footer"
          >
            <span
              className="todo-count"
              data-cy="TodosCounter"
            >
              {activeTodosCount} items left
            </span>

            <nav className="filter" data-cy="Filter">
              <a
                href="#/"
                className={`filter__link ${
                  filter === 'All' ? 'selected' : ''
                }`}
                data-cy="FilterLinkAll"
                onClick={() => setFilter('All')}
              >
                All
              </a>

              <a
                href="#/active"
                className={`filter__link ${
                  filter === 'Active' ? 'selected' : ''
                }`}
                data-cy="FilterLinkActive"
                onClick={() => setFilter('Active')}
              >
                Active
              </a>

              <a
                href="#/completed"
                className={`filter__link ${
                  filter === 'Completed' ? 'selected' : ''
                }`}
                data-cy="FilterLinkCompleted"
                onClick={() => setFilter('Completed')}
              >
                Completed
              </a>
            </nav>

            <button
              type="button"
              className="todoapp__clear-completed"
              data-cy="ClearCompletedButton"
              disabled={!hasCompletedTodos}
              onClick={clearCompleted}
            >
              Clear completed
            </button>
          </footer>
        )}
      </div>

      <div
        data-cy="ErrorNotification"
        className={`notification is-danger is-light has-text-weight-normal ${
          errorMessage ? '' : 'hidden'
        }`}
      >
        <button
          data-cy="HideErrorButton"
          type="button"
          className="delete"
          onClick={hideError}
        />

        {errorMessage}
      </div>
    </div>
  );
};
