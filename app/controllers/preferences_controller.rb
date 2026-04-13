class PreferencesController < ApplicationController
  def edit
    @user = current_user
  end

  def update
    @user = current_user
    if @user.update(preferences_params)
      redirect_to root_path, notice: "Preferences saved.", status: :see_other
    else
      render :edit, status: :unprocessable_entity
    end
  end

  private

  def preferences_params
    params.require(:user).permit(:price_range, :organic_preference)
  end
end
