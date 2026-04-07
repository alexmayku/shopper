class PreferencesController < ApplicationController
  def edit
    @user = current_user
  end

  def update
    @user = current_user
    if @user.update(preferences_params)
      redirect_to edit_preferences_path, notice: "Preferences saved.", status: :see_other
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def clear_tesco_credentials
    current_user.update!(tesco_email: nil, tesco_password: nil)
    redirect_to edit_preferences_path, notice: "Tesco credentials cleared.", status: :see_other
  end

  private

  def preferences_params
    params.require(:user).permit(:price_range, :organic_preference, :tesco_email, :tesco_password)
  end
end
